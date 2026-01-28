import type { VPNTestFormValues } from "./types";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function safeGetRandomValues(bytes: Uint8Array) {
  // Some environments may not expose `crypto.getRandomValues`.
  // Fallback keeps the feature usable offline (not for security purposes).
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return;
  }
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
}

function safeRandomUUID() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // RFC4122-ish v4 fallback
  const b = new Uint8Array(16);
  safeGetRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomString(len: number) {
  const bytes = new Uint8Array(len);
  safeGetRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function generateOfflineValues(input?: Partial<VPNTestFormValues>): VPNTestFormValues {
  const randomNumber = Math.floor(Math.random() * 1_000_000) + 1;
  const username = (`teste${randomNumber}`).slice(0, 20);
  const password = randomString(12).slice(0, 20);
  const v2rayUuid = safeRandomUUID();

  return {
    username: input?.username?.trim().slice(0, 20) || username,
    password: input?.password?.trim().slice(0, 20) || password,
    connectionLimit: input?.connectionLimit ?? 1,
    minutes: input?.minutes ?? 60,
    v2rayEnabled: input?.v2rayEnabled ?? true,
    v2rayUuid: input?.v2rayUuid || v2rayUuid,
  };
}

export function normalizeNumberish(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
