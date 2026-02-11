# ClawBoard ⚡️ — Development Plan

> The community leaderboard for OpenClaw power users. Anonymous by default, claimable, gamified. Like Strava for AI agent usage.

---

## A. Vision

### What It Is
ClawBoard is a web dashboard that connects to a user's local OpenClaw Gateway via WebSocket, pulls usage statistics (tokens, cost, sessions, models, tools), and displays them in a clean personal dashboard. Users can opt-in to share their stats anonymously to a global leaderboard, and later claim their profile via OAuth.

### Why It Matters
- **No visibility into usage**: OpenClaw users have no easy way to see their aggregate stats over time
- **Community engagement**: Gamification drives adoption and creates a sense of community among power users
- **Benchmarking**: Users want to know how their usage compares to others
- **Shareability**: "I processed 10M tokens this month" is a flex worth sharing on Twitter

### Design Principles
1. **Privacy-first**: Anonymous by default, explicit opt-in for sharing
2. **Real-time**: WebSocket connection for live stats, not stale snapshots
3. **Simple onboarding**: Paste URL + API key, see dashboard immediately
4. **Gamified but not toxic**: Celebrate usage, don't shame low activity
5. **Shareable**: One-click export to Twitter-card image

---

## B. Target User Experience

### Basic Usage
```
1. User visits clawboard.io
2. Enters their OpenClaw Gateway URL (e.g., http://127.0.0.1:18789)
3. Pastes their API key
4. Clicks "Connect"
5. Dashboard loads with their real-time stats:
   - Total tokens (all-time, 30d, 7d, 24h)
   - Total cost broken down by period
   - Message count, session count
   - Top 5 models by usage
   - Top 5 tools by frequency
   - Activity heatmap (messages per day)
```

### Advanced Usage
```
6. User toggles "Share Anonymously"
7. Their stats are added to global leaderboards
8. They get a unique shareable link: clawboard.io/u/abc123
9. User clicks "Export Card" → generates Twitter-optimized image
10. Later, user clicks "Claim Profile" → OAuth via GitHub/Twitter
11. Profile now shows their identity on leaderboards
```

---

## C. Technology Stack

### Language/Framework
- **Frontend**: Next.js 15 (App Router) + React 19
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Backend**: Next.js API Routes (serverless-friendly)
- **Database**: SQLite via Drizzle ORM (simple, file-based, portable)

### Core Dependencies
| Dependency | Purpose |
|------------|---------|
| `next` | Full-stack framework |
| `react` | UI library |
| `tailwindcss` v4 | Utility-first CSS |
| `drizzle-orm` | Type-safe database queries |
| `better-sqlite3` | SQLite driver |
| `ws` | WebSocket client for Gateway connection |
| `zod` | Runtime validation |
| `jose` | JWT handling for anonymous tokens |

### Optional Dependencies
| Dependency | Purpose |
|------------|---------|
| `next-auth` | OAuth for profile claiming |
| `react-chartjs-2` | Usage charts |
| `html-to-image` | Twitter card generation |
| `date-fns` | Date formatting |

---

## D. Project Structure

```
clawboard/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Root layout with providers
│   ├── page.tsx              # Landing page
│   ├── dashboard/
│   │   └── page.tsx          # Personal dashboard (requires connection)
│   ├── leaderboard/
│   │   └── page.tsx          # Global rankings
│   ├── u/
│   │   └── [token]/
│   │       └── page.tsx      # Shared profile page
│   └── api/
│       ├── connect/
│       │   └── route.ts      # Validate gateway connection
│       ├── sync/
│       │   └── route.ts      # Pull stats from gateway
│       ├── stats/
│       │   └── [token]/
│       │       └── route.ts  # Get stored stats for user
│       ├── leaderboard/
│       │   └── route.ts      # Get global rankings
│       ├── share/
│       │   └── route.ts      # Opt-in to anonymous sharing
│       └── claim/
│           └── route.ts      # OAuth profile claiming
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── ConnectForm.tsx       # Gateway URL + API key input
│   ├── StatsDashboard.tsx    # Main dashboard (cards + charts)
│   ├── StatsCard.tsx         # Individual stat display
│   ├── LeaderboardTable.tsx  # Rankings with filters
│   ├── ShareCard.tsx         # Exportable image for Twitter
│   ├── ClaimModal.tsx        # OAuth flow for identity
│   └── ActivityHeatmap.tsx   # GitHub-style activity grid
├── lib/
│   ├── db/
│   │   ├── schema.ts         # Drizzle schema
│   │   ├── index.ts          # Database connection
│   │   └── migrations/       # Drizzle migrations
│   ├── gateway/
│   │   ├── client.ts         # WebSocket client for Gateway
│   │   └── types.ts          # Gateway API types
│   ├── analytics.ts          # Stats aggregation functions
│   └── tokens.ts             # Anonymous token generation
├── public/
│   └── og-image.png          # Default social image
├── drizzle.config.ts         # Drizzle configuration
├── next.config.ts            # Next.js configuration
├── tailwind.config.ts        # Tailwind configuration
├── package.json
└── PLAN.md
```

---

## E. Command & API Design

### API Endpoints

#### `POST /api/connect`
Validate gateway connection and return available agents.

**Request:**
```json
{
  "gatewayUrl": "http://127.0.0.1:18789",
  "apiKey": "sk-..."
}
```

**Response:**
```json
{
  "success": true,
  "agents": [
    { "id": "agent:main", "name": "Main Agent", "status": "active" }
  ],
  "anonymousToken": "eyJ..."  // JWT for future requests
}
```

---

#### `POST /api/sync`
Pull fresh stats from connected gateway and store locally.

**Request:**
```json
{
  "anonymousToken": "eyJ...",
  "gatewayUrl": "http://127.0.0.1:18789",
  "apiKey": "sk-..."
}
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalTokens": 1234567,
    "totalCost": 12.34,
    "messageCount": 567,
    "sessionCount": 23,
    "topModels": [
      { "model": "claude-3-opus", "tokens": 500000 },
      { "model": "gpt-4", "tokens": 300000 }
    ],
    "topTools": [
      { "tool": "exec", "count": 150 },
      { "tool": "web_search", "count": 89 }
    ],
    "activity": [
      { "date": "2026-02-01", "messages": 45 },
      { "date": "2026-02-02", "messages": 32 }
    ]
  }
}
```

---

#### `GET /api/stats/[token]`
Get stored stats for a specific anonymous user.

**Response:**
```json
{
  "totalTokens": 1234567,
  "totalCost": 12.34,
  "messageCount": 567,
  "sessionCount": 23,
  "topModels": [...],
  "topTools": [...],
  "activity": [...],
  "shareEnabled": true,
  "claimed": false
}
```

---

#### `GET /api/leaderboard?category=tokens&period=30d`
Get global rankings for a category.

**Query Params:**
- `category`: `tokens` | `cost` | `messages` | `sessions` | `streak`
- `period`: `24h` | `7d` | `30d` | `all`

**Response:**
```json
{
  "category": "tokens",
  "period": "30d",
  "entries": [
    { "rank": 1, "anonymousId": "abc123", "value": 50000000, "claimed": true, "identity": "@eliaseffects" },
    { "rank": 2, "anonymousId": "def456", "value": 45000000, "claimed": false }
  ]
}
```

---

#### `POST /api/share`
Opt-in to anonymous sharing.

**Request:**
```json
{
  "anonymousToken": "eyJ...",
  "shareEnabled": true
}
```

---

#### `POST /api/claim`
Claim anonymous profile via OAuth.

**Request:**
```json
{
  "anonymousToken": "eyJ...",
  "oauthProvider": "twitter",
  "oauthCode": "..."
}
```

---

## F. Feature Breakdown

### Phase 1: MVP (Week 1-2)
- [ ] Gateway WebSocket client
- [ ] Connect form (URL + API key input)
- [ ] Basic dashboard with stat cards:
  - Total tokens, cost, messages, sessions
  - Top 5 models
  - Top 5 tools
- [ ] SQLite schema + Drizzle setup
- [ ] Anonymous token generation (JWT)
- [ ] Stats sync endpoint

### Phase 2: Polish (Week 3)
- [ ] Activity heatmap (GitHub-style)
- [ ] Time period filters (24h, 7d, 30d, all)
- [ ] Leaderboard page (tokens, cost, messages)
- [ ] Anonymous sharing toggle
- [ ] Shareable profile link (`/u/[token]`)
- [ ] Better loading states + error handling

### Phase 3: Advanced (Week 4)
- [ ] Twitter card export (html-to-image)
- [ ] OAuth claiming (GitHub, Twitter)
- [ ] Streak tracking (consecutive days active)
- [ ] Model diversity badge ("Tried 10+ models!")
- [ ] Dark/light mode toggle
- [ ] Mobile-responsive polish

---

## G. Testing Strategy

### Unit Tests
- Token generation/validation
- Stats aggregation functions
- Leaderboard ranking logic
- Database CRUD operations

### Integration Tests
- Gateway WebSocket connection flow
- Full sync cycle (connect → pull → store → display)
- OAuth claiming flow

### Manual Testing
- [ ] Connect to local gateway
- [ ] Connect to remote gateway (if applicable)
- [ ] Invalid API key handling
- [ ] Network error handling
- [ ] Leaderboard updates after sync
- [ ] Share toggle reflects in leaderboard
- [ ] Claim flow works end-to-end
- [ ] Twitter card looks correct

---

## H. Build & Release

### Build Configuration
- `next build` for production
- Static export for landing page (optional)
- Environment variables:
  - `DATABASE_URL` (SQLite path)
  - `NEXTAUTH_SECRET` (for OAuth)
  - `NEXTAUTH_URL` (production URL)

### CI/CD Pipeline
- GitHub Actions:
  - `ci`: lint, typecheck, test on PR
  - `deploy`: build + deploy to Vercel on main push

### Versioning
- Semantic versioning (v0.1.0 for MVP)
- Changelog in RELEASES.md

---

## I. Documentation

### README Structure
1. What is ClawBoard?
2. Quick Start (3 steps to dashboard)
3. Features
4. Privacy & Security
5. Self-Hosting (optional)
6. API Reference
7. Contributing

### API Documentation
- OpenAPI spec auto-generated from Zod schemas
- Endpoint examples in README

---

## J. Distribution Channels

1. **Hosted SaaS**: clawboard.io (Vercel + SQLite)
2. **Self-hosted option**: Docker compose for power users
3. **CLI tool** (future): `npx clawboard` for local-only mode

---

## K. Implementation Checklist

### Setup
- [ ] Create repository (GitHub)
- [ ] Initialize Next.js 15 with TypeScript
- [ ] Install Tailwind CSS v4 + shadcn/ui
- [ ] Set up Drizzle + SQLite
- [ ] Configure environment variables
- [ ] Set up CI/CD (GitHub Actions)

### Core Implementation
- [ ] Database schema (users, stats_snapshots, leaderboard)
- [ ] Gateway WebSocket client
- [ ] Connect form component
- [ ] Stats sync logic
- [ ] Dashboard layout + stat cards
- [ ] Leaderboard table component
- [ ] Anonymous token system
- [ ] Share toggle + profile page

### Testing
- [ ] Unit tests for core functions
- [ ] Integration tests for API routes
- [ ] Manual QA checklist

### Documentation
- [ ] README with quick start
- [ ] API documentation
- [ ] Privacy policy page

### Release
- [ ] Deploy to Vercel
- [ ] Configure custom domain (clawboard.io)
- [ ] First release (v0.1.0)
- [ ] Launch announcement tweet

---

## L. Post-Launch

### Improvements
- Team/org leaderboards (multiple users aggregated)
- Historical trends (charts over time)
- Export to CSV/JSON
- Webhook notifications (milestone alerts)
- Badges/achievements system
- API for third-party integrations

### Community
- GitHub Discussions for feature requests
- Discord channel in OpenClaw community
- Weekly "Top Users" tweet

---

## M. Success Metrics

| Metric | Target (Month 1) | Target (Month 3) |
|--------|------------------|------------------|
| Connected gateways | 50 | 500 |
| Opted-in to sharing | 30% | 50% |
| Claimed profiles | 20 | 200 |
| Daily active users | 20 | 100 |
| Twitter card shares | 10 | 100 |

---

*Status: Ready for Implementation*
