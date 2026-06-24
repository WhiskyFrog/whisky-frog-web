import { API_BASE_URL, authHeaders, ensureOk } from "./auth";

const base = `${API_BASE_URL}/api/admin/processing`;

export interface ProcessingRunResult {
  task_id: string;
  task: string;
  status: string;
}

export interface ProcessingJobStatus {
  task_id: string;
  state: string;
  result: unknown;
}

export async function triggerProcessing(
  limit?: number,
): Promise<ProcessingRunResult> {
  const res = await fetch(`${base}/run`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(limit !== undefined ? { limit } : {}),
  });
  await ensureOk(res);
  return (await res.json()) as ProcessingRunResult;
}

export async function getProcessingJobStatus(
  taskId: string,
  signal?: AbortSignal,
): Promise<ProcessingJobStatus> {
  const res = await fetch(`${base}/jobs/${encodeURIComponent(taskId)}`, {
    signal,
    cache: "no-store",
    headers: authHeaders(),
  });
  await ensureOk(res);
  return (await res.json()) as ProcessingJobStatus;
}
