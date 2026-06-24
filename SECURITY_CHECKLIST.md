# Security Checklist

Use this checklist before running the app on a public Render URL.

## Required Render Environment Variables

- `NODE_ENV=production`
- `JWT_SECRET`: long random value, at least 32 characters. Recommended: `openssl rand -base64 64`
- `JWT_EXPIRES_IN=8h`
- `CORS_ORIGIN=https://your-render-or-custom-domain`
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`: set both together when using Turso.

## Current Protections

- Login endpoint is rate limited.
- All API endpoints are rate limited.
- Express trusts Render proxy headers with `trust proxy`.
- Weak production env values are blocked on startup.
- Admin users cannot delete their own account.
- The last active admin cannot be deleted, deactivated, or demoted.
- Production dependency audit passes with `npm audit --omit=dev`.

## Operational Rules

- Do not share the Render URL publicly unless staff need it.
- Do not reuse passwords from other services.
- Disable accounts for staff who no longer need access.
- Keep `.env` files out of Git.
- Use HTTPS only. Render provides HTTPS for Render domains and custom domains.
- Review Settings audit logs after unusual activity.

## Known Follow-Up

- Browser token is stored in `localStorage`; this is acceptable for a small internal tool, but `httpOnly` cookie auth is safer for a larger public deployment.
- Full `npm audit` still reports a Vite/esbuild development-server advisory unless upgraded with a major Vite change. Production audit passes.
