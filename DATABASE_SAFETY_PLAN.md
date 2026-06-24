# Database Safety Plan

This document is the working plan for data-safety work in this project. Treat it as the source of truth before changing backup, restore, soft delete, audit log, or database workflows.

## Operating Principles

- Protect production data first. Prefer reversible changes and explicit confirmations.
- Keep changes small and phased. Avoid touching sales, stock, payment, and Turso sync behavior unless the phase requires it.
- Build and verify after every phase: `cd server && npm run build` and `npm run build`.
- Do not add a one-click full restore for Turso. Full restore is a controlled recovery procedure, not a routine UI action.
- Preserve business history. Sales, payments, and stock movement history should not disappear because a related record is hidden from daily views.

## Current Baseline

- Turso is the primary shared database for cross-machine usage.
- Customer soft delete is implemented first: deleting a customer hides it from normal customer lists and keeps purchase history intact.
- Customer audit logging is implemented for `create`, `update`, `delete`, and `restore`.
- Product soft delete is now implemented: deleting a product hides it from normal stock flows and keeps stock movement and sales history intact.
- Product audit logging is implemented for `create`, `update`, `delete`, and `restore`.
- Claim soft delete is now implemented: deleting a claim hides it from active claim/order/outstanding flows, restores stock, and keeps claim history intact.
- Claim audit logging is implemented for `create`, `update`, `delete`, and `restore`.
- Settings now includes admin-only restore sections for deleted customers, deleted products, and deleted claims.
- Settings now includes an admin audit-log viewer for recent create/update/delete/restore actions.
- Several destructive UI actions now show confirm dialogs before deleting.
- Export backups are implemented in `server/data/exports/` with admin list/download/delete controls.
- Automatic export is scheduled for `19:00` while the server process is running, with startup catch-up after `19:00`.
- Classic full restore is hidden/disabled in Turso mode and remains available only for local SQLite mode.

## Phase A: Safe Export Backups

Goal: create reliable `.db` export backups without enabling risky full restore.

Status: implemented.

- Add an export service that writes database snapshots to `server/data/exports/`.
- Add manual export from Settings for admin users.
- Add automatic export at `19:00` while the server process is running.
- Add catch-up export on server startup: if current local time is after `19:00` and today's export does not exist, create one.
- Add retention, defaulting to the latest `30` export files.
- Add Settings UI to list export files, show timestamp/size, download files, and delete files only after confirmation.
- Make export naming stable, for example `export_YYYYMMDD_HHMMSS.db`.

## Phase B: Disable Unsafe Restore In Turso Mode

Goal: remove confusion between local SQLite restore and Turso recovery.

Status: implemented.

- Detect backup mode from the backend and expose it to Settings.
- In Turso mode, hide or disable classic local restore controls.
- Show copy that export files are recovery snapshots, not one-click cloud restore buttons.
- Keep backend restore blocked in Turso mode with a clear error response.
- Keep local SQLite restore behavior only for local mode.

## Phase C: Controlled Restore Procedure

Goal: define safe recovery before building any restore tooling.

- Always export the current live database before recovery work.
- Open the target backup `.db` as a temporary recovery database.
- Inspect and compare records before writing anything back to Turso.
- Prefer item-level recovery: customer, purchase, payment, claim, or stock record repair.
- Use full database restore only for severe incidents such as corrupted schema, failed migration, or major data loss.
- Full restore must remain an admin/manual procedure with a separate checklist and a fresh current backup.

## Phase D: Expand Soft Delete And Audit

Goal: reduce day-to-day need for backup restore.

Status: implemented for current planned scope.

- `products`: implemented.
- `claims`: implemented.
- Do not soft-delete `purchases` or `payments` until reversal/void behavior is designed. These are financial history records.
- Reuse the existing `audit_logs` table and audit helper.
- Keep restore UI admin-only for each new soft-deleted entity.

## Future Phase: Financial Voids Instead Of Deletes

Goal: protect financial records without allowing accidental loss.

- Design void/reversal behavior for `purchases` before changing delete behavior there.
- Design void/reversal behavior for `payments` and `claim_payments` before changing delete behavior there.
- Keep original payment rows or record explicit reversal rows so cash history remains auditable.
- Avoid hard-deleting financial history from normal UI flows.

## Restore Guidance

Use this decision rule:

- Daily mistake: use soft delete restore or audit log investigation.
- Partial data issue: open an export backup as a temporary database and recover selected records.
- Severe system issue: perform controlled full restore only after exporting the current database and confirming the target backup.

## Acceptance Checks

- Backend build passes.
- Frontend build passes.
- Normal customer, sales, payment, stock, and report flows still work.
- Turso mode does not expose one-click restore.
- Export files can be created, listed, downloaded, and pruned.
- Restore-related wording never implies that Turso can safely roll back from the Settings page in one click.
