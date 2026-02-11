import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

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

const getDevicePath = (): string => path.join(process.cwd(), ".clawboard", "device.json");

const extractRawPublicKey = (spkiDer: Buffer): Buffer => spkiDer.subarray(-32);
const extractRawPrivateKey = (pkcs8Der: Buffer): Buffer => pkcs8Der.subarray(-32);

const fingerprintPublicKey = (rawPublicKey: Buffer): string =>
  crypto.createHash("sha256").update(rawPublicKey).digest("hex");

const generateDeviceIdentity = (): DeviceIdentity => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

  const rawPub = extractRawPublicKey(publicKey.export({ type: "spki", format: "der" }) as Buffer);
  const rawPriv = extractRawPrivateKey(privateKey.export({ type: "pkcs8", format: "der" }) as Buffer);

  return {
    deviceId: fingerprintPublicKey(rawPub),
    publicKey: rawPub.toString("base64url"),
    privateKey: rawPriv.toString("base64url"),
  };
};

const readDeviceIdentity = async (): Promise<DeviceIdentity | null> => {
  try {
    const raw = await fs.readFile(getDevicePath(), "utf-8");
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

const writeDeviceIdentity = async (identity: DeviceIdentity): Promise<void> => {
  const devicePath = getDevicePath();
  await fs.mkdir(path.dirname(devicePath), { recursive: true });
  await fs.writeFile(devicePath, JSON.stringify(identity, null, 2), "utf-8");
};

export const getOrCreateDeviceIdentity = async (): Promise<DeviceIdentity> => {
  const existing = await readDeviceIdentity();
  if (existing) {
    return existing;
  }

  const identity = generateDeviceIdentity();
  await writeDeviceIdentity(identity);
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

export const signConnectChallenge = async (params: {
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

  const rawPriv = Buffer.from(params.identity.privateKey, "base64url");
  const pkcs8Header = Buffer.from("302e020100300506032b657004220420", "hex");
  const pkcs8Der = Buffer.concat([pkcs8Header, rawPriv]);

  const privateKeyObject = crypto.createPrivateKey({
    key: pkcs8Der,
    format: "der",
    type: "pkcs8",
  });

  const signature = crypto.sign(null, Buffer.from(payload, "utf-8"), privateKeyObject);

  return {
    id: params.identity.deviceId,
    publicKey: params.identity.publicKey,
    signature: signature.toString("base64url"),
    signedAt: signedAtMs,
  };
};
