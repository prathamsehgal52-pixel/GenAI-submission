# Armoire

A personal AI stylist built around the clothes you already own: a digital wardrobe from your photos, outfits generated only from your own pieces, and new products ranked by how well they work with what you have.

## Architecture

| Layer | Choice |
|---|---|
| Web app | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router. The marketing site lives at `/`, the product at `/app`. |
| API | Hono on Node.js (`server/`). The same process serves the built web app in production. |
| Database | PostgreSQL with Drizzle ORM and SQL migrations (`server/db/migrations`). |
| Auth | Better Auth: email and password, database sessions in httpOnly cookies, password reset by email, account deletion. |
| Storage | Private S3-compatible bucket. Photos are re-encoded server-side (metadata stripped) and served only through signed URLs. |
| Jobs | pg-boss, a Postgres-backed queue. It runs garment recognition, discovery refreshes, a daily scheduled sweep and maintenance in `server/worker.ts`. |
| AI | Anthropic Claude behind a provider interface (`server/services/ai`), with structured, schema-validated output. |
| Products | eBay Browse API (official) and authorised affiliate feeds (e.g. Awin) behind a provider interface (`server/services/products`). |
| Weather | Open-Meteo forecast and geocoding (no key needed). |
| Email | SMTP via nodemailer. |

Shared domain logic lives in `shared/`. That covers the taxonomy, request schemas and the deterministic styling rules (`shared/styling.ts`) behind outfit scoring, product matching and insights.

### How the core features work

- **Garment recognition.** An upload is validated and stored, and a recognition job is queued. The worker sends a compact rendition to the vision model and gets back schema-validated garments with bounding boxes. Multi-garment photos are cropped into separate items. Items arrive in **review**; nothing joins the wardrobe until the user confirms it. AI-derived fields are labelled "Estimated from photo" until the user edits or confirms them. Transient failures retry with backoff; after three attempts the photo is marked failed, and the user can retry or describe it by hand. Identical re-uploads are deduplicated by hash.
- **Styling.** Candidate outfits are built only from the user's active items. They're scored with the shared rules: colour harmony, formality, pattern balance, occasion, weather (only when a real forecast exists), style preferences and feedback. The model chooses among those candidates and writes the explanation. Every returned item ID is re-validated against the user's items before saving. If AI is unavailable, the rule-based explanation is used. Identical recent requests are served from cache.
- **Discovery.** Queries are planned from wardrobe gaps and preferences, then each configured source is searched. Listings are upserted with their source, price, URL and last-verified time. Each product is scored against the wardrobe with the same pairing rules, so a figure like "Pairs with 6 of your pieces" is a real computed count. Product links must be https and on an allow-listed host.

## Local development

Requirements: Node 22+ and Docker.

```bash
cp .env.example .env              # then set AUTH_SECRET (openssl rand -base64 48)
docker compose up -d              # Postgres, S3-compatible storage (SeaweedFS), Mailpit
npm install
npm run db:migrate
npm run dev                       # web :5173, API :8787, worker
```

Email sent locally is captured at http://localhost:8025.

Without `ANTHROPIC_API_KEY`, uploads still work and items arrive in review for the user to describe; styling uses rule-based explanations. Without product source credentials, Discover shows a "not available right now" state. Nothing is fabricated in either case.

## Tests

```bash
npm test            # API integration and unit tests (Vitest, real Postgres: armoire_test)
npm run test:e2e    # Browser journey (Playwright, system Chrome, desktop + mobile)
npm run typecheck
npm run lint
```

Automated tests replace two external services with explicit test fixtures, configured in `.env.test` and `.env.e2e`. The AI provider (`AI_PROVIDER=fixture`) derives attributes deterministically from synthetic images, and the product source (`PRODUCT_PROVIDERS=fixture`) serves a five-item test catalogue. Unit tests also use memory storage, in-memory email and inline jobs. The configuration refuses all of these unless `APP_ENV=test`, so they can never run in production. The e2e suite uses real Postgres, real S3-compatible storage and a real worker process.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md).
