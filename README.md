# FORMA — Santa Elena

Budget tracker for Condominio Santa Elena (FORMA Capital Inmobiliario, Antigua Guatemala).

Pilot project for FORMA's holding-wide data normalization initiative. See [SDD_FORMA_SANTA_ELENA.md](SDD_FORMA_SANTA_ELENA.md) for the product spec, [PLAN.md](PLAN.md) for the batched implementation plan, and [PROGRESS.md](PROGRESS.md) for the live tracker.

## Requirements

- Node `>=20.11` (currently pinned to `22` via `.nvmrc`)
- pnpm `10.x`

```bash
nvm use            # picks Node from .nvmrc
corepack enable    # ensures pnpm is available
pnpm install
```

## Local development

```bash
cp .env.example .env.local   # then fill in real values (see Batch 2 in PLAN.md for keys)
pnpm dev                     # http://localhost:3000
```

## Scripts

| Command             | What it does                           |
| ------------------- | -------------------------------------- |
| `pnpm dev`          | Start the dev server (Turbopack)       |
| `pnpm build`        | Production build                       |
| `pnpm start`        | Serve the production build             |
| `pnpm typecheck`    | `tsc --noEmit` over the codebase       |
| `pnpm lint`         | ESLint (flat config) over the codebase |
| `pnpm lint:fix`     | ESLint with auto-fix                   |
| `pnpm format`       | Prettier write                         |
| `pnpm format:check` | Prettier check (no writes)             |

## Stack (locked)

- **Framework:** Next.js 16 (App Router) + React 19
- **Styling:** Tailwind CSS 4 + Shadcn/ui primitives
- **DB + Auth:** Supabase (Postgres + Auth + Storage + RLS) — wired in Batch 2
- **ORM:** Prisma — wired in Batch 2
- **Hosting:** Vercel — wired in Batch 19

See [PROGRESS.md §2 Locked Decisions](PROGRESS.md#2-locked-decisions) for the full decision log.

## Operating contract

[\_THE_RULES.MD](_THE_RULES.MD) — non-negotiable. Read before contributing.
