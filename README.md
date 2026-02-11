# Clawtally

Clawtally is a read‑only telemetry dashboard for OpenClaw. It connects to a local gateway, visualizes usage, and optionally shares anonymized snapshots to a public leaderboard.

## Why Clawtally

- Read‑only by design. No commands, no tool invocation, no file writes.
- Local‑first connection via a connector daemon.
- Fast, clean UI for usage, models, tools, cache, latency, and error rates.
- Optional community leaderboard and shared profiles.

## What’s Included

- Ecosystem overview and leaderboard pages.
- Personal dashboard with `/usage`‑equivalent metrics.
- One‑click local connector flow.
- Pairing flow for agent‑driven setup.
- Health check endpoints for monitoring.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Run the app:

```bash
npm run dev
```

3. Run the local connector in a second terminal:

```bash
npm run connector
```

Open `http://localhost:3000`.

`npm run dev` uses Turbopack by default. If you need webpack dev mode, use `npm run dev:webpack`.

## Production Build

```bash
npm run build
npm run start
```

## Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

For the connector daemon you can set:

```bash
export CLAWBOARD_GATEWAY_URL=ws://localhost:18789
export CLAWBOARD_GATEWAY_TOKEN=your-token-if-required
npm run connector
```

## Local Connector Contract (One‑Click)

Clawtally probes these origins:

- `http://127.0.0.1:18888`
- `http://localhost:18888`
- `http://127.0.0.1:18889`
- `http://localhost:18889`

Expected endpoints:

1. `GET /v1/clawboard/discovery`

```json
{
  "name": "Clawtally Connector",
  "version": "0.1.0",
  "gatewayUrl": "ws://localhost:18789",
  "hasGatewayToken": true
}
```

2. `POST /v1/clawboard/session`

```json
{
  "gatewayUrl": "ws://localhost:18789",
  "apiKey": "gateway-token-or-ephemeral-ticket"
}
```

3. `POST /v1/clawboard/pair`

```json
{
  "dashboardUrl": "https://clawtally.com",
  "code": "OPTIONALCODE",
  "expiresInSeconds": 600,
  "source": "agent"
}
```

## Connector Daemon

Run:

```bash
npm run connector
```

It serves on `http://127.0.0.1:18888` by default and reads gateway config from:

- `CLAWBOARD_GATEWAY_URL` / `OPENCLAW_GATEWAY_URL` (plus token env vars)
- `.clawboard-connector/config.json`
- `.reality-ops/config.json`
- `../reality-ops/.reality-ops/config.json`

Optional local config format:

```json
{
  "url": "ws://localhost:18789",
  "apiKey": "optional-token"
}
```

## Health Check

- HTML: `/health`
- JSON: `/api/health`

These are safe to hit from uptime monitors.

## API Surface

- `POST /api/connect`
- `POST /api/sync`
- `GET /api/stats/[token]`
- `POST /api/usage/window`
- `GET /api/leaderboard`
- `POST /api/share`
- `POST /api/pair/register`
- `POST /api/pair/claim`
- `POST /api/claim` (stub)

## Data Storage

This repo uses an in‑memory store for fast iteration:

- `lib/data/store.ts`
- `lib/data/pairing-store.ts`

Server restarts clear stats and pair codes. For production, replace with a real database.

## Security Notes

Clawtally is read‑only. It does not:

- Execute tasks
- Invoke tools
- Write files
- Modify OpenClaw state

It only reads usage telemetry to render analytics.

## Scripts

- `npm run dev` — Next.js dev server (Turbopack)
- `npm run dev:webpack` — Next.js dev server (webpack)
- `npm run build` — Production build
- `npm run start` — Production server
- `npm run typecheck` — TypeScript check
- `npm run connector` — Local connector daemon

## Social Image Prompt

Use this to generate a share image for the README:

```
A clean, modern social card for an open‑source project named “Clawtally”. Dark space background with subtle stars and soft teal/coral glows. Centered wordmark text “CLAWTALLY” in a bold geometric sans‑serif, with “CLAW” in white and “TALLY” in coral. Subheading below: “Read‑only OpenClaw telemetry and community leaderboard.” Include a small URL “clawtally.com” at the bottom. Minimal, crisp, high‑contrast, 1200x630.
```

## License

MIT. See `LICENSE`.
