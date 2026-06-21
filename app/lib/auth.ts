// 관리자 인증 — JWT(Authorization: Bearer).
// 로그인으로 토큰을 발급받아 localStorage에 보관하고, admin API 호출 시 Bearer로 싣는다.
// 계약: POST /api/admin/login {username,password} → {access_token,token_type,expires_in}.
// 모든 /api/admin/* 은 HTTPBearer 필요(불일치/만료 401). 인증 강제는 백엔드(DECISIONS 021).

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const TOKEN_KEY = "wf_admin_jwt";

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}

function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function logout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

/** 토큰 보유 여부(= 로그인 추정). 실제 유효성은 서버가 401로 판정. */
export function isAuthed(): boolean {
  return getToken() !== "";
}

interface TokenOut {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** 관리자 로그인 → JWT 발급·저장. 실패 시 throw. */
export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    let detail: string;
    if (res.status === 401) detail = "아이디 또는 비밀번호가 올바르지 않습니다.";
    else if (res.status === 503)
      detail = "관리자 인증이 서버에 설정되지 않았습니다 (503).";
    else {
      detail = `로그인 실패 (HTTP ${res.status})`;
      try {
        const body = await res.json();
        if (typeof body?.detail === "string") detail = body.detail;
      } catch {
        /* 본문 없음 */
      }
    }
    throw new Error(detail);
  }
  const data = (await res.json()) as TokenOut;
  setToken(data.access_token);
}

/** 인증 헤더(Bearer). json=true면 Content-Type도 포함. */
export function authHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/** 응답을 검사하고 실패 시 detail 메시지로 throw. 401이면 토큰 폐기(재로그인 유도). */
export async function ensureOk(res: Response): Promise<void> {
  if (res.ok) return;
  let detail = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") detail = body.detail;
    else if (Array.isArray(body?.detail)) {
      // FastAPI 422 검증 오류
      detail = body.detail
        .map((e: { loc?: unknown[]; msg?: string }) => {
          const field = Array.isArray(e.loc) ? e.loc.slice(1).join(".") : "";
          return field ? `${field}: ${e.msg}` : e.msg;
        })
        .join(", ");
    }
  } catch {
    /* 본문 없음 */
  }
  if (res.status === 401) {
    logout(); // 만료/무효 토큰 폐기
    detail = "로그인이 필요하거나 세션이 만료되었습니다.";
  }
  throw new Error(detail);
}
