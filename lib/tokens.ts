import { createHmac } from "node:crypto";

const SECRET = process.env.CLAWBOARD_TOKEN_SECRET ?? "clawboard-dev-secret";

interface AnonymousTokenPayload {
  sub: string;
  iat: number;
}

const base64UrlEncode = (value: string): string =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const base64UrlDecode = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
};

const sign = (encodedPayload: string): string =>
  createHmac("sha256", SECRET)
    .update(encodedPayload)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

export const issueAnonymousToken = (subject: string): string => {
  const payload: AnonymousTokenPayload = {
    sub: subject,
    iat: Math.floor(Date.now() / 1000),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
};

export const verifyAnonymousToken = (token: string): AnonymousTokenPayload | null => {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  if (sign(encodedPayload) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AnonymousTokenPayload;
    if (!payload.sub || typeof payload.sub !== "string") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};
