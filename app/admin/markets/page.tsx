"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteMarket, listMarkets, type Market } from "../../lib/markets";
import { MarketForm } from "./MarketForm";

type Status = "loading" | "error" | "ready";
// 목록 보기 | 새 마켓 | 특정 마켓 수정
type View = { mode: "list" } | { mode: "new" } | { mode: "edit"; market: Market };

export default function MarketsAdminPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [rows, setRows] = useState<Market[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [view, setView] = useState<View>({ mode: "list" });

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

  async function handleDelete(m: Market) {
    if (!window.confirm(`'${m.name}' 마켓을 삭제할까요? (배송옵션도 함께 삭제)`))
      return;
    try {
      await deleteMarket(m.id);
      load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "삭제 실패");
    }
  }

  function handleFormDone() {
    setView({ mode: "list" });
    load();
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
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">마켓 관리</h2>
          <p className="mt-1 text-sm text-gray-500">
            사이트별 통화·세금·배송 설정. 크롤러/비용엔진이 이 값을 읽어 계산합니다.
          </p>
        </div>
        <button
          onClick={() => setView({ mode: "new" })}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          + 새 마켓
        </button>
      </div>

      {status === "loading" && (
        <div className="py-16 text-center text-gray-500">불러오는 중…</div>
      )}

      {status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-10 text-center">
          <p className="font-medium text-red-700">마켓을 불러오지 못했습니다.</p>
          <p className="mt-1 text-sm text-red-500">{errorMsg}</p>
          <button
            onClick={() => load()}
            className="mt-3 rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-100"
          >
            다시 시도
          </button>
        </div>
      )}

      {status === "ready" && rows.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-16 text-center">
          <p className="font-medium text-gray-700">등록된 마켓이 없습니다.</p>
          <p className="mt-1 text-sm text-gray-500">
            “+ 새 마켓”으로 첫 마켓을 추가하세요.
          </p>
        </div>
      )}

      {status === "ready" && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 text-left text-gray-600">
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
                <tr
                  key={m.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-mono text-gray-700">{m.code}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {m.name}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{m.domain}</td>
                  <td className="px-3 py-2 text-gray-600">{m.currency}</td>
                  <td className="px-3 py-2 text-center">
                    {m.active ? (
                      <span className="text-green-600">●</span>
                    ) : (
                      <span className="text-gray-300">●</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-500">
                    {m.shipping_options.length}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setView({ mode: "edit", market: m })}
                      className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(m)}
                      className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
