# BACKEND-NEEDS.md

Endpoints and fields the finalized frontend template needs but the engine
does not expose yet. The frontend renders honest unavailable states for
all of these — nothing is fabricated or hardcoded to fill the gap.

Everything the M26 milestone added is live in the UI now:

- `GET /cases` (paginated, status/q filters) → Cases register table
- `GET /admin/users/me` → top-bar operator chip
- `GET /cases/{case_id}/latest` → case detail scores, attribution terminal
  reason, report & certificate card, "Open report" button
- `GET /reports/{report_id}` → full report + evidentiary certificate page
- `GET /filings` (paginated, status filter) → Filings register table
- `GET /filings/{filing_id}` → filing detail (summary, transmission log,
  linked report)
- `POST /filings/{filing_id}/resend` → server-side signed re-send, recorded
  as a NEW filing row
- `GET /intel/links/ranked` → Intelligence ranked-tag feed
- `GET /watchlist/{watch_id}/checks` → watch check history table
- `PATCH /watchlist/{watch_id}/alerts/{alert_id}` → alert disposition
- Watch detail now carries `classification`, `cadence_minutes`,
  `lifetime_checks`, `lifetime_alerts`, `alerts_24h`, `check_history[]`,
  `alerts[]` with disposition metadata
- `GET /cases/{case_id}/graph/stats` now carries `classifier_breakdown`
  and `daily_activity` (last-30-day counts for the workbench chart)
- Graph path hops now carry `kind` + `confidence`; terminal reason is
  surfaced on the path response and the case detail attribution card
- Admin users now carry `email`; `last_active` is honestly `null`
  (no such column exists — see below)

## Genuine remaining gaps

Each claim below was verified against the backend routers on 2026-09-28.

1. **Case record** (`api/routers/cases.py::_dump`): no `assignee` field (only
   `officer_id`, a free string), no `updated_at` (only `created_at`).
   The register's "Opened" column uses `created_at`; there is no assignee
   name to show.
2. **Case status enum**: statuses are free strings. The engine emits
   `"received"` on registration and `"attributed"` when a trace completes
   (`worker/__init__.py:133`); nothing else sets a case status. The filter
   tabs use exactly these two.
3. **Filing `ack_ref` is always null**: `worker/__init__.py` never sets it,
   and the SAHYOG mock's acknowledgement payloads carry `{"ack": true}` but
   no reference string (`integrations/sahyog_mock/mock_server.py:81`). This
   is a mock limitation, not a missing endpoint — the filing detail page
   says so instead of showing a fake reference.
4. **Watch alerts have no `signal`, `points`, or `severity`**: the alert dump
   (`api/routers/watchlist.py::_enrich`) never had these fields; the alerts
   table shows the real fields (tx, direction, counterparty, value, asset,
   VASP hit, disposition) and does not pretend the others exist.
5. **`GET /cases/{case_id}/links` has no strength score**: entries carry
   `case_id`, `overlap`, and `shared_tags` only.
6. **Admin `last_active` is honestly null**: there is no `last_active`
   column (`api/routers/admin.py::_dump` returns `None` by design).
7. **Health/readiness** (`GET /health`, `GET /ready`): no per-service
   operational model beyond store/queue/graph class names. The status bar
   maps those class names honestly (memory fallback = dot down).

## Static protocol choices (documented, not fabricated)

These are not backend data — they are fixed protocol/enumeration choices
the engine itself defines, kept in the frontend with their source cited:

- **Chains** (`lib/chains.ts`): ethereum, bitcoin, tron, solana, bsc — the
  engine's adapter set per the master reference (BSC added in M15). The
  backend takes `chain` as a free string, so there is no metadata endpoint
  to read this from yet; replace the import with a backend call if one
  appears.
- **User roles** (`app/admin/users/new/page.tsx`): viewer, analyst, auditor,
  admin — copied verbatim from the backend's `VALID_ROLES`
  (`api/routers/admin.py`); the backend rejects anything else.
- **Case statuses** (`app/cases/page.tsx`): received, attributed — the only
  two statuses the engine emits (see gap 2).
- **Filing statuses** (`app/filings/page.tsx`): pending, delivered, failed —
  copied verbatim from `engine/store/base.py` (`FILING_PENDING`,
  `FILING_DELIVERED`, `FILING_FAILED`).
- **Alert dispositions** (`lib/api/watchlist.ts`): true_positive,
  false_positive, benign, escalated — the backend's `VALID_DISPOSITIONS`
  (`api/routers/watchlist.py`); anything else is rejected.
- **Jurisdiction hints**: the engine's deployment context is FIU-IND /
  SAHYOG (India), so placeholder hints may show "IN" as a format example.
  No jurisdiction is ever pre-selected or submitted by default.

No other names, IDs, numbers, or records are hardcoded anywhere in the UI:
every input placeholder is a neutral format hint, and every data panel
renders live API data or an honest unavailable state.

## Notes

- Template counts, timestamps, names, scores and records visible in the
  design SVGs are illustrative only and are never copied into the UI.
- Sanctions-proximity scoring stays deferred; the UI must not present it
  as active.
- `GET /feedback/outcomes` has no `case_id` filter; the case detail page
  filters client-side by `case_id`.
