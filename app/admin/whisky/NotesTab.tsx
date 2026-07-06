"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteClassifierNote,
  listClassifierNotes,
  saveClassifierNote,
  type ClassifierNote,
} from "../../lib/adminWhisky";
import {
  DataTable,
  ErrorBanner,
  FormButtons,
  inputClass,
  Pager,
  RowActions,
} from "./ui";
import { actionBtn } from "../../components/actionButton";

const LIMIT = 100;

export default function NotesTab() {
  const [rows, setRows] = useState<ClassifierNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<ClassifierNote | null>(null);
  const [topic, setTopic] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setErrorMsg("");
      listClassifierNotes(
        { search: search.trim() || undefined, limit: LIMIT, offset },
        signal,
      )
        .then((data) => {
          setRows(data);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
          setLoading(false);
        });
    },
    [search, offset],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function resetForm() {
    setEditing(null);
    setTopic("");
    setBody("");
  }

  async function submit() {
    setSaving(true);
    setErrorMsg("");
    try {
      await saveClassifierNote(
        { topic: topic.trim(), body: body.trim() },
        editing?.id,
      );
      resetForm();
      load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  function remove(row: ClassifierNote) {
    if (!window.confirm(`노트 "${row.topic}" 삭제?`)) return;
    deleteClassifierNote(row.id)
      .then(() => load())
      .catch((err: unknown) =>
        setErrorMsg(err instanceof Error ? err.message : "삭제 실패"),
      );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        분류기 텍스트 위키 — LLM 프롬프트에 주입되는 분류 노하우입니다. 최근
        수정 순으로 표시됩니다.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="토픽 검색"
          className="w-56 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
        <button type="button" onClick={() => { setOffset(0); load(); }} className={actionBtn.neutral}>
          조회
        </button>
      </div>

      <ErrorBanner message={errorMsg} />

      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="self-start rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
        >
          <h3 className="mb-3 font-semibold">
            {editing ? `노트 수정 #${editing.id}` : "노트 추가"}
          </h3>
          <div className="space-y-3">
            <input
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="토픽"
              className={inputClass}
            />
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="본문"
              rows={8}
              className={inputClass}
            />
            <FormButtons saving={saving} onCancel={editing ? resetForm : undefined} />
          </div>
        </form>

        <div>
          <DataTable loading={loading} empty={rows.length === 0}>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2 align-top">
                  <div className="font-medium">{row.topic}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(row.updated_at).toLocaleString("ko-KR")}
                  </div>
                </td>
                <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="line-clamp-3 max-w-xl whitespace-pre-wrap">
                    {row.body}
                  </div>
                </td>
                <td className="px-3 py-2 text-right align-top">
                  <RowActions
                    onEdit={() => {
                      setEditing(row);
                      setTopic(row.topic);
                      setBody(row.body);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    onDelete={() => remove(row)}
                  />
                </td>
              </tr>
            ))}
          </DataTable>
          <Pager offset={offset} limit={LIMIT} count={rows.length} onMove={setOffset} />
        </div>
      </section>
    </div>
  );
}
