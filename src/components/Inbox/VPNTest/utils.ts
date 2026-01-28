import type { VPNTestFormValues } from "./types";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function randomString(len: number) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function generateOfflineValues(input?: Partial<VPNTestFormValues>): VPNTestFormValues {
  const randomNumber = Math.floor(Math.random() * 1_000_000) + 1;
  const username = (`teste${randomNumber}`).slice(0, 20);
  const password = randomString(12).slice(0, 20);
  const v2rayUuid = crypto.randomUUID();

  return {
    username: input?.username?.trim().slice(0, 20) || username,
    password: input?.password?.trim().slice(0, 20) || password,
    connectionLimit: input?.connectionLimit ?? 1,
    minutes: input?.minutes ?? 60,
    v2rayEnabled: input?.v2rayEnabled ?? true,
    v2rayUuid: input?.v2rayUuid || v2rayUuid,
    ownerId: input?.ownerId,
  };
}

export function normalizeNumberish(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
