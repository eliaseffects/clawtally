import { sha256 } from "@noble/hashes/sha256";
import { sha512 } from "@noble/hashes/sha512";
import { bytesToHex, concatBytes } from "@noble/hashes/utils";
import * as ed25519 from "@noble/ed25519";

import type { GatewayUsageCostResponse, GatewayUsageResponse } from "@/lib/gateway/types";

type GatewayConnectionInput = {
  gatewayUrl: string;
  apiKey?: string;
};

interface DeviceIdentity {
  deviceId: string;
  publicKey: string;
  privateKey: string;
}

interface DeviceSignature {
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
}

const DEVICE_STORAGE_KEY = "clawtally.device";

const CLIENT_ID = "gateway-client";
const CLIENT_MODE = "backend";
const ROLE = "operator";
const SCOPES: ReadonlyArray<string> = ["operator.read", "operator.write", "operator.admin"];

const DEFAULT_TIMEOUT_MS = 10_000;

if (!ed25519.etc.sha512Sync) {
  ed25519.etc.sha512Sync = (...messages: Uint8Array[]) => sha512(concatBytes(...messages));
}

const normalizeGatewayUrl = (gatewayUrl: string): string => {
  const trimmed = gatewayUrl.trim().replace(/\/+$/, "");

  if (/^wss?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${url.host}${url.pathname}`.replace(/\/+$/, "");
  }

  return `ws://${trimmed}`;
};

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

const getStoredIdentity = (): DeviceIdentity | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DeviceIdentity>;
    if (
      typeof parsed.deviceId !== "string" ||
      typeof parsed.publicKey !== "string" ||
      typeof parsed.privateKey !== "string"
    ) {
      return null;
    }
    return {
      deviceId: parsed.deviceId,
      publicKey: parsed.publicKey,
      privateKey: parsed.privateKey,
    };
  } catch {
    return null;
  }
};

const storeIdentity = (identity: DeviceIdentity) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(identity));
};

const getOrCreateDeviceIdentity = async (): Promise<DeviceIdentity> => {
  const existing = getStoredIdentity();
  if (existing) {
    return existing;
  }

  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKey(privateKey);
  const deviceId = bytesToHex(sha256(publicKey));

  const identity: DeviceIdentity = {
    deviceId,
    publicKey: toBase64Url(publicKey),
    privateKey: toBase64Url(privateKey),
  };

  storeIdentity(identity);
  return identity;
};

const buildDeviceAuthPayload = (params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: ReadonlyArray<string>;
  signedAtMs: number;
  token: string;
}): string =>
  [
    "v1",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token,
  ].join("|");

const signConnectChallenge = async (params: {
  identity: DeviceIdentity;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: ReadonlyArray<string>;
  token: string;
}): Promise<DeviceSignature> => {
  const signedAtMs = Date.now();

  const payload = buildDeviceAuthPayload({
    deviceId: params.identity.deviceId,
    clientId: params.clientId,
    clientMode: params.clientMode,
    role: params.role,
    scopes: params.scopes,
    signedAtMs,
    token: params.token,
  });

  const privateKey = fromBase64Url(params.identity.privateKey);
  const signature = await ed25519.sign(new TextEncoder().encode(payload), privateKey);

  return {
    id: params.identity.deviceId,
    publicKey: params.identity.publicKey,
    signature: toBase64Url(signature),
    signedAt: signedAtMs,
  };
};

const buildConnectParams = async (input: GatewayConnectionInput) => {
  const identity = await getOrCreateDeviceIdentity();
  const token = input.apiKey ?? "";

  const device = await signConnectChallenge({
    identity,
    clientId: CLIENT_ID,
    clientMode: CLIENT_MODE,
    role: ROLE,
    scopes: SCOPES,
    token,
  });

  return {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: CLIENT_ID,
      displayName: "Clawtally",
      version: "0.1.0",
      platform: "node",
      mode: CLIENT_MODE,
      instanceId: `clawtally-web-${Date.now()}`,
    },
    role: ROLE,
    scopes: SCOPES,
    device,
    ...(token ? { auth: { token } } : {}),
  };
};

const rawFrameToText = async (raw: unknown): Promise<string> => {
  if (typeof raw === "string") {
    return raw;
  }

  if (raw instanceof Blob) {
    return await raw.text();
  }

  if (raw instanceof ArrayBuffer) {
    return new TextDecoder().decode(raw);
  }

  if (ArrayBuffer.isView(raw)) {
    return new TextDecoder().decode(raw.buffer);
  }

  return String(raw);
};

const createRequestId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const gatewayRequest = async <T>(
  input: GatewayConnectionInput,
  method: string,
  params?: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> => {
  const connectParams = await buildConnectParams(input);
  const wsUrl = normalizeGatewayUrl(input.gatewayUrl);

  return await new Promise<T>((resolve, reject) => {
    const connectId = createRequestId("connect");
    const requestId = createRequestId("req");
    let settled = false;
    let handshakeComplete = false;

    const ws = new WebSocket(wsUrl);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      callback();
    };

    timer = setTimeout(() => {
      settle(() => {
        try {
          ws.close();
        } catch {
          // ignore close failures on timeout
        }
        reject(new Error(`Gateway request timed out after ${timeoutMs}ms`));
      });
    }, timeoutMs);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "req",
          id: connectId,
          method: "connect",
          params: connectParams as Record<string, unknown>,
        }),
      );
    };

    ws.onmessage = async (messageEvent) => {
      if (settled) {
        return;
      }

      let frame: { type?: string; id?: string; payload?: T; result?: T; error?: { message: string; code?: string } };
      try {
        frame = JSON.parse(await rawFrameToText(messageEvent.data)) as typeof frame;
      } catch {
        return;
      }

      if (frame.type !== "res") {
        return;
      }

      if (!handshakeComplete && frame.id === connectId) {
        if (frame.error) {
          settle(() => reject(new Error(`Gateway handshake failed: ${frame.error?.message ?? "Unknown error"}`)));
          return;
        }

        handshakeComplete = true;
        ws.send(
          JSON.stringify({
            type: "req",
            id: requestId,
            method,
            ...(params ? { params } : {}),
          }),
        );
        return;
      }

      if (handshakeComplete && frame.id === requestId) {
        settle(() => {
          try {
            ws.close();
          } catch {
            // ignore close failures after response
          }

          if (frame.error) {
            reject(new Error(`Gateway error${frame.error.code ? ` [${frame.error.code}]` : ""}: ${frame.error.message}`));
            return;
          }

          resolve((frame.payload ?? frame.result) as T);
        });
      }
    };

    ws.onerror = () => {
      settle(() => {
        reject(new Error("Gateway connection error"));
      });
    };

    ws.onclose = () => {
      if (settled) {
        return;
      }

      settle(() => {
        reject(new Error("Gateway connection closed unexpectedly"));
      });
    };
  });
};

const fetchUsageSnapshot = async (
  input: GatewayConnectionInput,
  params?: Record<string, unknown>,
): Promise<GatewayUsageResponse> => {
  const usage = await gatewayRequest<GatewayUsageResponse>(input, "sessions.usage", params);
  if (!usage || !Array.isArray(usage.sessions) || !usage.totals) {
    throw new Error("sessions.usage response is missing expected fields.");
  }
  return usage;
};

const fetchUsageCostSummary = async (
  input: GatewayConnectionInput,
  params?: Record<string, unknown>,
): Promise<GatewayUsageCostResponse> => {
  const costSummary = await gatewayRequest<GatewayUsageCostResponse>(input, "usage.cost", params);
  if (!costSummary || typeof costSummary !== "object") {
    throw new Error("usage.cost response is missing expected fields.");
  }
  return costSummary;
};

export const fetchGatewayUsageWindowBrowser = async (
  input: GatewayConnectionInput,
  params: { startDate: string; endDate: string; limit?: number },
): Promise<{ usage: GatewayUsageResponse; cost: GatewayUsageCostResponse }> => {
  const limit = params.limit ?? 1000;

  const [usage, cost] = await Promise.all([
    fetchUsageSnapshot(input, {
      startDate: params.startDate,
      endDate: params.endDate,
      limit,
      includeContextWeight: true,
    }),
    fetchUsageCostSummary(input, {
      startDate: params.startDate,
      endDate: params.endDate,
    }),
  ]);

  return { usage, cost };
};
