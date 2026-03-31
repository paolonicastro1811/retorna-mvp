# Local Development Setup

## Database Options

**Option 1: Neon (cloud, recommended for quick start)**
- Create a free project at https://neon.tech
- Copy connection string to `.env` as `DATABASE_URL`

**Option 2: Docker (local)**
- Requires Docker Desktop + WSL on Windows
- Uses `docker-compose.yml` in project root (PostgreSQL 16)

## Quick Start

```bash
# 1. Start database
#    Neon: just set DATABASE_URL in .env
#    Docker: npm run db:up

# 2. Run migrations
npx prisma migrate dev --name init

# 3. Start backend
npm run dev

# 4. (Optional) Expose for Meta webhook testing
#    See WEBHOOK_TUNNEL_SETUP.md
```

## Commands

| Command | What it does |
|---------|-------------|
| `npm run db:up` | Start PostgreSQL container (background) |
| `npm run db:down` | Stop PostgreSQL container |
| `npm run db:reset` | Destroy volume + restart (clean slate) |
| `npm run db:logs` | Tail PostgreSQL logs |
| `npx prisma migrate dev` | Apply pending migrations |
| `npx prisma studio` | Open Prisma Studio (DB browser) |

## Connection Details

| Field | Value |
|-------|-------|
| Host | `localhost` |
| Port | `5432` |
| User | `postgres` |
| Password | `postgres` |
| Database | `reactivation_mvp` |
| URL | `postgresql://postgres:postgres@localhost:5432/reactivation_mvp` |

## Notes

- Backend reads `DATABASE_URL` from `.env` — make sure it matches the Docker credentials above.
- Data persists in the `postgres_data` Docker volume. Use `npm run db:reset` to wipe everything.
- If port 5432 is already in use, stop any local PostgreSQL service first.
- For Meta WhatsApp webhook testing, see `WEBHOOK_TUNNEL_SETUP.md`.
