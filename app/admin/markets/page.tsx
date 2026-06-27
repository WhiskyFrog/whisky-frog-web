"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { deleteMarket, listMarkets, type Market } from "../../lib/markets";
import {
  listCrawlHistory,
  triggerCrawl,
  triggerParse,
  type CrawlJob,
} from "../../lib/crawl";
import { MarketForm } from "./MarketForm";
import { ProductUrlList } from "./ProductUrlList";
import { actionBtn } from "../../components/actionButton";
import { triggerProcessing } from "../../lib/processing";

/** 진행 중(running) 잡에서 크롤 중인 마켓 도메인 집합 추출.
 *  소스 = DB 원장(history?status=running) — 라이브 워커 inspect는 간헐 빈응답으로 깜빡임. */
function runningDomainSet(jobs: CrawlJob[]): Set<string> {
  const s = new Set<string>();
  for (const j of jobs) {
    if (j.domain && j.name.startsWith("crawler.")) s.add(j.domain);
  }
  return s;
}

function processingDomainSet(jobs: CrawlJob[]): Set<string> {
  const s = new Set<string>();
  for (const j of jobs) {
    if (j.domain && j.name === "processing.run_batch") s.add(j.domain);
  }
  return s;
}

// 방금 트리거한 도메인의 낙관적 잠금 유지 시간(ms).
// 잡이 Celery에 enqueue된 직후엔 history?status=running에 아직 안 올라와,
// 폴링이 runningDomains를 통째 교체하며 낙관적 잠금을 지워버린다(깜빡임).
// 그래서 폴링과 무관한 별도 집합에 도메인을 넣고 이 시간 동안 잠금을 보장한다.
// 그 안에 폴링이 잡을 running으로 확인하면 runningDomains가 잠금을 이어받는다.
const PENDING_LOCK_MS = 30000;

/** domain을 집합에 추가하고 PENDING_LOCK_MS 후 자동 제거(폴링이 못 덮어쓰는 낙관적 잠금). */
function lockPending(
  setter: Dispatch<SetStateAction<Set<string>>>,
  domain: string,
) {
  setter((s) => new Set(s).add(domain));
  setTimeout(() => {
    setter((s) => {
      if (!s.has(domain)) return s;
      const next = new Set(s);
      next.delete(domain);
      return next;
    });
  }, PENDING_LOCK_MS);
}

type Status = "loading" | "error" | "ready";
// 목록 보기 | 새 마켓 | 특정 마켓 수정 | 상품 URL 보기
type View =
  | { mode: "list" }
  | { mode: "new" }
  | { mode: "edit"; market: Market }
  | { mode: "urls"; market: Market };

export default function MarketsAdminPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [rows, setRows] = useState<Market[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [view, setView] = useState<View>({ mode: "list" });
  const [crawling, setCrawling] = useState<number | null>(null); // 수집 트리거 in-flight 마켓 id
  const [parsing, setParsing] = useState<number | null>(null); // 상세 파싱 트리거 in-flight 마켓 id
  const [processing, setProcessing] = useState<number | null>(null);
  // 현재 크롤 진행 중인 마켓 도메인(버튼 잠금용). 백엔드가 최종 가드지만 UI도 선제 차단.
  const [runningDomains, setRunningDomains] = useState<Set<string>>(new Set());
  const [processingDomains, setProcessingDomains] = useState<Set<string>>(new Set());
  // 방금 트리거한 도메인(낙관적 잠금) — 폴링이 덮어쓰지 못하는 별도 집합. lockPending 참고.
  const [pendingDomains, setPendingDomains] = useState<Set<string>>(new Set());
  const [pendingProcessing, setPendingProcessing] = useState<Set<string>>(
    new Set(),
  );
  // 비블로킹 알림(window.alert 대체) — alert은 메인스레드를 막아 잠금 페인트를 삼킴.
  const [toast, setToast] = useState<{ kind: "info" | "error"; msg: string } | null>(
    null,
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, kind: "info" | "error" = "info") => {
    setToast({ kind, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => setToast(null),
      kind === "error" ? 6000 : 4000,
    );
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const load = useCallback((signal?: AbortSignal) => {
    setStatus("loading");
    listMarkets(signal)
      .then((data) => {
        setRows(data);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // 진행 중 마켓 추적 — 버튼 잠금/해제. 끝나면 자동으로 풀리도록 주기 폴링(DB 원장 기반).
  const refreshActive = useCallback((signal?: AbortSignal) => {
    listCrawlHistory({ status: "running", limit: 200 }, signal)
      .then((jobs) => {
        setRunningDomains(runningDomainSet(jobs));
        setProcessingDomains(processingDomainSet(jobs));
      })
      .catch(() => {
        /* 조회 실패는 무시(백엔드 락/409가 최종 가드) */
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refreshActive(controller.signal);
    const timer = setInterval(() => refreshActive(), 15000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refreshActive]);

  async function handleDelete(m: Market) {
    if (!window.confirm(`'${m.name}' 마켓을 삭제할까요? (배송옵션도 함께 삭제)`))
      return;
    try {
      await deleteMarket(m.id);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "삭제 실패", "error");
    }
  }

  function handleFormDone() {
    setView({ mode: "list" });
    load();
  }

  async function handleCrawl(m: Market) {
    // 빈 입력=전체 수집 / 숫자 입력=스모크(해당 페이지 수만). CrawlIn.max_pages 계약.
    const ans = window.prompt(
      `'${m.name}' 수집을 실행합니다.\n전체 수집은 비워두고 확인, 스모크는 페이지 수(예: 1)를 입력하세요.\n취소하려면 Esc.`,
      "",
    );
    if (ans === null) return; // 취소
    const trimmed = ans.trim();
    let maxPages: number | undefined;
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n <= 0) {
        showToast("페이지 수는 1 이상의 정수여야 합니다.", "error");
        return;
      }
      maxPages = n;
    }
    setCrawling(m.id);
    try {
      await triggerCrawl(m.id, maxPages);
      // 즉시 잠금(낙관적, 폴링이 못 덮어씀) + 활성 잡 동기화.
      lockPending(setPendingDomains, m.domain);
      refreshActive();
      showToast(
        "수집 작업을 등록했습니다. '데이터 수집 관리 > 진행 중'에서 상태를 확인하세요.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "수집 실행 실패";
      // 409: 이미 진행 중(연타 방지) → 에러 대신 안내하고 버튼 잠금.
      if (/already running|진행 중|409/i.test(msg)) {
        lockPending(setPendingDomains, m.domain);
        showToast(
          "이미 이 마켓 수집이 진행 중입니다. '데이터 수집 관리 > 진행 중'에서 확인하세요.",
        );
      } else {
        showToast(msg, "error");
      }
    } finally {
      setCrawling(null);
    }
  }

  async function handleParse(m: Market) {
    // 빈 입력=미파싱 전체 / 숫자 입력=이번 런 처리 수 제한. ParseIn.limit 계약.
    const ans = window.prompt(
      `'${m.name}' 상세 파싱(stage-2)을 실행합니다.\n전체는 비워두고 확인, 일부만 처리하려면 건수(예: 50)를 입력하세요.\n취소하려면 Esc.`,
      "",
    );
    if (ans === null) return; // 취소
    const trimmed = ans.trim();
    let limit: number | undefined;
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n <= 0) {
        showToast("건수는 1 이상의 정수여야 합니다.", "error");
        return;
      }
      limit = n;
    }
    setParsing(m.id);
    try {
      await triggerParse(m.id, limit);
      // 파싱은 수집과 같은 마켓 락을 공유 → 낙관적 잠금 + 활성 잡 동기화.
      lockPending(setPendingDomains, m.domain);
      refreshActive();
      showToast(
        "상세 파싱 작업을 등록했습니다. '데이터 수집 관리 > 진행 중'에서 상태를 확인하세요.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "상세 파싱 실행 실패";
      // 409: 같은 마켓 수집/파싱이 이미 진행 중(락 공유) → 안내 후 버튼 잠금.
      if (/already running|진행 중|409/i.test(msg)) {
        lockPending(setPendingDomains, m.domain);
        showToast(
          "이미 이 마켓 수집/파싱이 진행 중입니다. '데이터 수집 관리 > 진행 중'에서 확인하세요.",
        );
      } else {
        showToast(msg, "error");
      }
    } finally {
      setParsing(null);
    }
  }

  async function handleProcess(m: Market) {
    const ans = window.prompt(
      `'${m.name}' 상품 상세 프로세싱을 실행합니다.\n전체는 비워두고 확인, 일부만 처리하려면 건수(예: 50)를 입력하세요.\n취소하려면 Esc.`,
      "",
    );
    if (ans === null) return;
    const trimmed = ans.trim();
    let limit: number | undefined;
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n <= 0) {
        showToast("건수는 1 이상의 정수여야 합니다.", "error");
        return;
      }
      limit = n;
    }

    setProcessing(m.id);
    try {
      await triggerProcessing(m.id, limit);
      lockPending(setPendingProcessing, m.domain);
      refreshActive();
      showToast(
        `프로세싱 작업이 등록됐습니다. '데이터 수집 관리 > 진행 중'에서 상태를 확인하세요. '${m.name}' 마켓만 처리합니다.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "프로세싱 실행 실패";
      if (/already running|진행 중|409/i.test(msg)) {
        lockPending(setPendingProcessing, m.domain);
        refreshActive();
        showToast(
          "이미 프로세싱 작업이 진행 중입니다. '데이터 수집 관리 > 진행 중'에서 확인하세요.",
        );
      } else {
        showToast(msg, "error");
      }
    } finally {
      setProcessing(null);
    }
  }

  if (view.mode === "urls") {
    return (
      <ProductUrlList
        market={view.market}
        onBack={() => setView({ mode: "list" })}
      />
    );
  }

  if (view.mode !== "list") {
    return (
      <MarketForm
        market={view.mode === "edit" ? view.market : null}
        onDone={handleFormDone}
        onCancel={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div>
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <div
            className={
              toast.kind === "error"
                ? "rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                : "rounded-md border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            }
          >
            <div className="flex items-start gap-3">
              <span className="whitespace-pre-wrap">{toast.msg}</span>
              <button
                onClick={() => setToast(null)}
                aria-label="닫기"
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">마켓 관리</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            사이트별 통화·세금·배송 설정. 크롤러/비용엔진이 이 값을 읽어 계산합니다.
          </p>
        </div>
        <button
          onClick={() => setView({ mode: "new" })}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
        >
          + 새 마켓
        </button>
      </div>

      {status === "loading" && (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">
          불러오는 중…
        </div>
      )}

      {status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-10 text-center dark:border-red-900 dark:bg-red-950/40">
          <p className="font-medium text-red-700 dark:text-red-300">
            마켓을 불러오지 못했습니다.
          </p>
          <p className="mt-1 text-sm text-red-500 dark:text-red-400">
            {errorMsg}
          </p>
          <button
            onClick={() => load()}
            className="mt-3 rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            다시 시도
          </button>
        </div>
      )}

      {status === "ready" && rows.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            등록된 마켓이 없습니다.
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            “+ 새 마켓”으로 첫 마켓을 추가하세요.
          </p>
        </div>
      )}

      {status === "ready" && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 text-left text-gray-600 dark:border-gray-600 dark:text-gray-400">
                <th className="px-3 py-2 font-medium">code</th>
                <th className="px-3 py-2 font-medium">name</th>
                <th className="px-3 py-2 font-medium">domain</th>
                <th className="px-3 py-2 font-medium">currency</th>
                <th className="px-3 py-2 text-center font-medium">active</th>
                <th className="px-3 py-2 text-center font-medium">배송옵션</th>
                <th className="px-3 py-2 text-right font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <Fragment key={m.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td
                      rowSpan={2}
                      className="border-b border-gray-100 px-3 py-2 align-top font-mono text-gray-700 dark:border-gray-800 dark:text-gray-300"
                    >
                      {m.code}
                    </td>
                    <td
                      rowSpan={2}
                      className="border-b border-gray-100 px-3 py-2 align-top font-medium text-gray-900 dark:border-gray-800 dark:text-gray-100"
                    >
                      {m.name}
                    </td>
                    <td
                      rowSpan={2}
                      className="border-b border-gray-100 px-3 py-2 align-top text-gray-600 dark:border-gray-800 dark:text-gray-400"
                    >
                      {m.domain}
                    </td>
                    <td
                      rowSpan={2}
                      className="border-b border-gray-100 px-3 py-2 align-top text-gray-600 dark:border-gray-800 dark:text-gray-400"
                    >
                      {m.currency}
                    </td>
                    <td
                      rowSpan={2}
                      className="border-b border-gray-100 px-3 py-2 text-center align-top dark:border-gray-800"
                    >
                      {m.active ? (
                        <span className="text-green-600 dark:text-green-400">
                          ●
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">
                          ●
                        </span>
                      )}
                    </td>
                    <td
                      rowSpan={2}
                      className="border-b border-gray-100 px-3 py-2 text-center align-top text-gray-500 dark:border-gray-800 dark:text-gray-400"
                    >
                      {m.shipping_options.length}
                    </td>
                    <td className="px-3 py-1 text-right text-xs text-gray-400 dark:text-gray-500">
                      관리
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleCrawl(m)}
                          disabled={
                            crawling === m.id ||
                            runningDomains.has(m.domain) ||
                            pendingDomains.has(m.domain)
                          }
                          className={actionBtn.run}
                        >
                          {crawling === m.id
                            ? "실행 중…"
                            : runningDomains.has(m.domain) ||
                                pendingDomains.has(m.domain)
                              ? "진행 중"
                              : "수집 실행"}
                        </button>
                        <button
                          onClick={() => handleParse(m)}
                          disabled={
                            parsing === m.id ||
                            crawling === m.id ||
                            runningDomains.has(m.domain) ||
                            pendingDomains.has(m.domain)
                          }
                          className={actionBtn.accent}
                        >
                          {parsing === m.id ? "파싱 중…" : "상세 파싱"}
                        </button>
                        <button
                          onClick={() => handleProcess(m)}
                          disabled={
                            processing === m.id ||
                            processingDomains.has(m.domain) ||
                            pendingProcessing.has(m.domain)
                          }
                          className={actionBtn.accent}
                        >
                          {processing === m.id ||
                          processingDomains.has(m.domain) ||
                          pendingProcessing.has(m.domain)
                            ? "처리 중…"
                            : "프로세스"}
                        </button>
                        <button
                          onClick={() => setView({ mode: "urls", market: m })}
                          className={actionBtn.neutral}
                        >
                          상품 URL
                        </button>
                        <button
                          onClick={() => setView({ mode: "edit", market: m })}
                          className={actionBtn.edit}
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className={actionBtn.danger}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
