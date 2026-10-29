export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "smartclaim_token";

export function getToken(): string | null {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; auth?: boolean };

async function request(path: string, { body, auth = true, headers, ...init }: Options = {}) {
  const h = new Headers(headers);
  const token = auth ? getToken() : null;
  if (token) h.set("Authorization", `Bearer ${token}`);
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    h.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, { ...init, headers: h, body: payload });
  } catch {
    throw new ApiError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่ภายหลัง", 0);
  }
  if (!res.ok) {
    let detail = `เกิดข้อผิดพลาด (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") detail = data.detail;
    } catch {
      /* not json */
    }
    if (res.status === 401 && token) setToken(null);
    throw new ApiError(detail, res.status);
  }
  return res;
}

export async function api<T>(path: string, opts?: Options): Promise<T> {
  const res = await request(path, opts);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiBlob(path: string, opts?: Options): Promise<Blob> {
  const res = await request(path, opts);
  return res.blob();
}

export async function download(path: string, filename: string) {
  const blob = await apiBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** ส่งคำเตือน (non-blocking) จากหน้าฟอร์มไปแสดงที่หน้ารายละเอียดคำขอ */
export function stashWarnings(requestId: number, warnings: string[]) {
  try {
    if (warnings.length) sessionStorage.setItem(`warnings_${requestId}`, JSON.stringify(warnings));
  } catch {
    /* storage unavailable */
  }
}

export function popWarnings(requestId: number | string): string[] {
  try {
    const key = `warnings_${requestId}`;
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function fileApiPath(rel: string) {
  return `/files/${rel}`;
}
