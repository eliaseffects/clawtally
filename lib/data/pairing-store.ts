import { randomBytes } from "node:crypto";

export interface PairingRecord {
  code: string;
  gatewayUrl: string;
  gatewayApiKey?: string;
  source?: string;
  createdAtMs: number;
  expiresAtMs: number;
  claimedAtMs?: number;
  claimedByUserId?: string;
}

interface PairingStore {
  records: Map<string, PairingRecord>;
}

declare global {
  // eslint-disable-next-line no-var
  var __clawboardPairingStore: PairingStore | undefined;
}

const DEFAULT_EXPIRY_SECONDS = 10 * 60;
const MAX_EXPIRY_SECONDS = 24 * 60 * 60;

const getStore = (): PairingStore => {
  if (!globalThis.__clawboardPairingStore) {
    globalThis.__clawboardPairingStore = {
      records: new Map<string, PairingRecord>(),
    };
  }

  return globalThis.__clawboardPairingStore;
};

const normalizeCode = (code: string): string => code.trim().toUpperCase();

export const isValidPairingCode = (code: string): boolean => /^[A-Z0-9-]{6,40}$/.test(code);

const randomCode = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let value = "";
  for (let index = 0; index < bytes.length; index += 1) {
    value += alphabet[bytes[index] % alphabet.length];
  }
  return value;
};

const cleanupExpired = (): void => {
  const now = Date.now();
  for (const [code, record] of getStore().records.entries()) {
    if (record.expiresAtMs < now || (record.claimedAtMs && now - record.claimedAtMs > 60 * 60 * 1000)) {
      getStore().records.delete(code);
    }
  }
};

export const createPairing = (input: {
  code?: string;
  gatewayUrl: string;
  gatewayApiKey?: string;
  source?: string;
  expiresInSeconds?: number;
}): PairingRecord => {
  cleanupExpired();

  let code = input.code ? normalizeCode(input.code) : randomCode();
  if (!isValidPairingCode(code)) {
    throw new Error("Pairing code must be 6-40 chars (A-Z, 0-9, -)");
  }

  // Retry random generation on collisions.
  if (!input.code) {
    let attempts = 0;
    while (getStore().records.has(code) && attempts < 8) {
      code = randomCode();
      attempts += 1;
    }
  }

  const existing = getStore().records.get(code);
  if (existing && !existing.claimedAtMs && existing.expiresAtMs > Date.now()) {
    throw new Error("Pairing code already exists and is still active");
  }

  const expiresInSeconds = Math.max(30, Math.min(input.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS, MAX_EXPIRY_SECONDS));
  const now = Date.now();

  const record: PairingRecord = {
    code,
    gatewayUrl: input.gatewayUrl,
    gatewayApiKey: input.gatewayApiKey,
    source: input.source,
    createdAtMs: now,
    expiresAtMs: now + expiresInSeconds * 1000,
  };

  getStore().records.set(code, record);
  return record;
};

export const getPairingStatus = (rawCode: string):
  | { ok: true; record: PairingRecord }
  | { ok: false; reason: "not_found" | "expired" | "claimed" } => {
  cleanupExpired();

  const code = normalizeCode(rawCode);
  const record = getStore().records.get(code);

  if (!record) {
    return { ok: false, reason: "not_found" };
  }

  if (record.expiresAtMs < Date.now()) {
    getStore().records.delete(code);
    return { ok: false, reason: "expired" };
  }

  if (record.claimedAtMs) {
    return { ok: false, reason: "claimed" };
  }

  return { ok: true, record };
};

export const markPairingClaimed = (rawCode: string, userId: string): PairingRecord | null => {
  const status = getPairingStatus(rawCode);
  if (!status.ok) {
    return null;
  }

  const updated: PairingRecord = {
    ...status.record,
    claimedAtMs: Date.now(),
    claimedByUserId: userId,
  };

  getStore().records.set(updated.code, updated);
  return updated;
};
