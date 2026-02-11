#!/usr/bin/env node

import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const CONNECTOR_NAME = "ClawBoard Connector";
const CONNECTOR_VERSION = process.env.npm_package_version || "0.1.0";

const HOST = process.env.CLAWBOARD_CONNECTOR_HOST || "127.0.0.1";
const PORT = Number.parseInt(process.env.CLAWBOARD_CONNECTOR_PORT || "18888", 10);

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://clawboard.io",
  "https://www.clawboard.io",
];

const DASHBOARD_URL = (process.env.CLAWBOARD_DASHBOARD_URL || "http://localhost:3000").replace(/\/+$/, "");

const ENV_URL_KEYS = ["CLAWBOARD_GATEWAY_URL", "OPENCLAW_GATEWAY_URL"];
const ENV_TOKEN_KEYS = ["CLAWBOARD_GATEWAY_TOKEN", "OPENCLAW_GATEWAY_TOKEN", "OPENCLAW_GATEWAY_API_KEY"];

const fromEnv = (keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
};

const normalizeGatewayUrl = (gatewayUrl) => {
  const trimmed = gatewayUrl.trim().replace(/\/+$/, "");

  if (/^wss?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, "");
  }

  return `ws://${trimmed}`;
};

const candidateConfigPaths = () => {
  const explicit = process.env.CLAWBOARD_CONNECTOR_GATEWAY_CONFIG;
  const cwd = process.cwd();

  const paths = [
    explicit,
    path.join(cwd, ".clawboard-connector", "config.json"),
    path.join(cwd, ".reality-ops", "config.json"),
    path.resolve(cwd, "..", "reality-ops", ".reality-ops", "config.json"),
  ].filter(Boolean);

  return [...new Set(paths)];
};

const loadGatewayConfigFromFile = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    const url = typeof parsed?.url === "string" ? parsed.url.trim() : "";
    const apiKey = typeof parsed?.apiKey === "string" ? parsed.apiKey.trim() : "";

    if (!url) {
      return null;
    }

    return {
      gatewayUrl: normalizeGatewayUrl(url),
      apiKey,
      source: filePath,
    };
  } catch {
    return null;
  }
};

const resolveGatewayConfig = async () => {
  const envUrl = fromEnv(ENV_URL_KEYS);
  const envToken = fromEnv(ENV_TOKEN_KEYS);

  if (envUrl) {
    return {
      gatewayUrl: normalizeGatewayUrl(envUrl),
      apiKey: envToken,
      source: "environment",
    };
  }

  for (const filePath of candidateConfigPaths()) {
    const config = await loadGatewayConfigFromFile(filePath);
    if (config?.gatewayUrl) {
      return config;
    }
  }

  return null;
};

const parseAllowedOrigins = () => {
  const raw = process.env.CLAWBOARD_CONNECTOR_ALLOWED_ORIGINS;
  if (!raw || raw.trim().length === 0) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : DEFAULT_ALLOWED_ORIGINS;
};

const ALLOWED_ORIGINS = parseAllowedOrigins();

const isOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }

  if (ALLOWED_ORIGINS.includes("*")) {
    return true;
  }

  for (const rule of ALLOWED_ORIGINS) {
    if (rule.endsWith("*")) {
      const prefix = rule.slice(0, -1);
      if (origin.startsWith(prefix)) {
        return true;
      }
      continue;
    }

    if (origin === rule) {
      return true;
    }
  }

  return false;
};

const applyCorsHeaders = (request, response) => {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }

  if (!isOriginAllowed(origin)) {
    return false;
  }

  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Clawboard-Pair-Secret");
  response.setHeader("Access-Control-Max-Age", "3600");
  return true;
};

const sendJson = (response, status, payload) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
};

const readJsonBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const text = Buffer.concat(chunks).toString("utf-8").trim();
  if (!text) {
    return {};
  }

  return JSON.parse(text);
};

const handleDiscovery = async (request, response) => {
  const config = await resolveGatewayConfig();
  return sendJson(response, 200, {
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    gatewayUrl: config?.gatewayUrl,
    hasGatewayToken: Boolean(config?.apiKey),
    configured: Boolean(config?.gatewayUrl),
    source: config?.source || null,
    pairEndpoint: "/v1/clawboard/pair",
    sessionEndpoint: "/v1/clawboard/session",
  });
};

const handleSession = async (request, response) => {
  const config = await resolveGatewayConfig();
  if (!config) {
    return sendJson(response, 503, {
      error:
        "No local OpenClaw config found. Set CLAWBOARD_GATEWAY_URL / OPENCLAW_GATEWAY_URL or create .clawboard-connector/config.json",
    });
  }

  let body = {};
  try {
    body = await readJsonBody(request);
  } catch {
    return sendJson(response, 400, { error: "Invalid JSON body" });
  }

  const scope = typeof body.scope === "string" && body.scope.length > 0 ? body.scope : "usage.read";

  return sendJson(response, 200, {
    gatewayUrl: config.gatewayUrl,
    apiKey: config.apiKey || "",
    scope,
    issuedAt: new Date().toISOString(),
  });
};

const handlePair = async (request, response) => {
  const config = await resolveGatewayConfig();
  if (!config) {
    return sendJson(response, 503, {
      error:
        "No local OpenClaw config found. Set CLAWBOARD_GATEWAY_URL / OPENCLAW_GATEWAY_URL or create .clawboard-connector/config.json",
    });
  }

  let body = {};
  try {
    body = await readJsonBody(request);
  } catch {
    return sendJson(response, 400, { error: "Invalid JSON body" });
  }

  const dashboardUrl =
    typeof body.dashboardUrl === "string" && body.dashboardUrl.trim().length > 0
      ? body.dashboardUrl.trim().replace(/\/+$/, "")
      : DASHBOARD_URL;

  const registerUrl = `${dashboardUrl}/api/pair/register`;

  const payload = {
    gatewayUrl: config.gatewayUrl,
    apiKey: config.apiKey || "",
    ...(typeof body.code === "string" && body.code.trim().length > 0 ? { code: body.code.trim().toUpperCase() } : {}),
    ...(typeof body.expiresInSeconds === "number" ? { expiresInSeconds: body.expiresInSeconds } : {}),
    source: typeof body.source === "string" && body.source.trim().length > 0 ? body.source.trim() : "local-connector",
  };

  const headers = {
    "Content-Type": "application/json",
  };

  const pairingSecret = process.env.CLAWBOARD_PAIRING_SECRET;
  if (pairingSecret) {
    headers["x-clawboard-pair-secret"] = pairingSecret;
  }

  let upstream;
  try {
    upstream = await fetch(registerUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return sendJson(response, 502, {
      error: `Unable to reach ${registerUrl}: ${message}`,
    });
  }

  let upstreamBody;
  try {
    upstreamBody = await upstream.json();
  } catch {
    upstreamBody = { error: "Pair register upstream returned invalid JSON" };
  }

  return sendJson(response, upstream.status, {
    ...upstreamBody,
    connector: {
      name: CONNECTOR_NAME,
      version: CONNECTOR_VERSION,
    },
  });
};

const server = http.createServer(async (request, response) => {
  if (!request.url || !request.method) {
    return sendJson(response, 400, { error: "Malformed request" });
  }

  const corsOk = applyCorsHeaders(request, response);
  if (!corsOk) {
    return sendJson(response, 403, { error: "Origin not allowed by connector" });
  }

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    return response.end();
  }

  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);

  if (request.method === "GET" && url.pathname === "/v1/clawboard/discovery") {
    return handleDiscovery(request, response);
  }

  if (request.method === "POST" && url.pathname === "/v1/clawboard/session") {
    return handleSession(request, response);
  }

  if (request.method === "POST" && url.pathname === "/v1/clawboard/pair") {
    return handlePair(request, response);
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, { ok: true, name: CONNECTOR_NAME, version: CONNECTOR_VERSION });
  }

  return sendJson(response, 404, {
    error: "Not found",
    available: [
      "GET /v1/clawboard/discovery",
      "POST /v1/clawboard/session",
      "POST /v1/clawboard/pair",
      "GET /health",
    ],
  });
});

server.listen(PORT, HOST, async () => {
  const config = await resolveGatewayConfig();
  const source = config?.source || "not configured";
  const gatewayUrl = config?.gatewayUrl || "not configured";

  console.log(`${CONNECTOR_NAME} v${CONNECTOR_VERSION}`);
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Gateway: ${gatewayUrl}`);
  console.log(`Config source: ${source}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
});

server.on("error", (error) => {
  console.error("Connector server error:", error);
  process.exitCode = 1;
});
