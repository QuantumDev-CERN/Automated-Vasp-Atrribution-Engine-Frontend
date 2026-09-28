# BACKEND-NEEDS.md

Endpoints and fields the finalized frontend template needs but the engine
does not expose yet. The frontend renders honest unavailable states for
all of these — nothing is fabricated or hardcoded to fill the gap.

## Missing endpoints

1. **`GET /cases`** — paginated case collection with filters (status, search).
   Needed by: Cases list table, counts, filter tabs, search, pagination.
2. **`GET /admin/users/me`** — identity behind the configured `X-API-Key`.
   Needed by: top-bar operator chip (slot stays empty until this exists).
3. **`GET /cases/{case_id}/latest`** (or job/report ids on the case record) —
   case → latest trace job + report lookup.
   Needed by: case detail scores, attribution panel, report & certificate card,
   "Open report" button.
4. **`GET /filings`** — paginated filings registry (ref, filed, subject, type,
   channel, status, ack ref).
   Needed by: Filings register table, status filter tabs, pagination.
5. **`GET /filings/{filing_id}`** — single filing detail (summary, signals
   cited, transmission log, acknowledgement).
   Needed by: Filing detail page. (The SAHYOG mock's `GET /sahyog/cases/{id}`
   covers mock-submitted cases only, in memory.)
6. **`POST /filings/{filing_id}/resend`** — server-side signed re-send of the
   attribution webhook. The frontend must not hold `SAHYOG_WEBHOOK_SECRET`.
   Needed by: "Re-send webhook" on the filing detail page.
7. **`POST /intel/infrastructure`** (or `GET /intel/infrastructure`) — ranked
   entity feed across all tags. Only the single-tag
   `GET /intel/infrastructure/{tag}` exists.
   Needed by: Intelligence "Ranked entities" section.
8. **Watch alert disposition** — `PATCH /watchlist/{watch_id}/alerts/{alert_id}`
   accepting an analyst disposition. No such route exists.
   Needed by: watch detail alert dispositions.

## Missing fields on existing endpoints

9. **Case record** (`GET /cases/{case_id}`): no `risk`, `confidence`,
   `assignee`, `updated_at`, or trace/report summary fields. The template's
   list columns (Risk, Confidence, Updated, Assignee) and the detail "SCORES"
   panel cannot be populated. (`officer_id` is shown as the assignee source
   where the template needs a name — currently rendered from `officer_id`.)
10. **Graph stats** (`GET /cases/{case_id}/graph/stats`): returns
    addresses/transfers/transactions only — not the peel/sweep/mixer/bridge
    classifier breakdown the template shows.
11. **Graph path** (`GET /cases/{case_id}/graph/path`): hops carry address,
    kind, confidence, reason — but the template's per-hop value/asset/tx and
    the header's terminal VASP name / confidence / risk are not present.
12. **Watch record** (`GET /watchlist`): no `cadence`, `hits_24h`,
    `classification`, `lifetime_hits`, or check history. Columns render "—".
13. **Watch alert** (`GET /watchlist/{watch_id}/alerts`): no `signal`,
    `points`, `severity`, or `disposition`. The alerts table shows the real
    fields instead (tx, direction, counterparty, value, asset, VASP hit).
14. **Admin user** (`GET /admin/users`): no `email` or `last_active`.
    Columns render "—".
15. **Health/readiness** (`GET /health`, `GET /ready`): no per-service
    operational model beyond store/queue/graph class names. The status bar
    maps those class names honestly (memory fallback = dot down).
16. **Transaction activity** (workbench "last 30 days" chart): no endpoint
    provides per-day activity counts.

## Notes

- Template counts, timestamps, names, scores and records visible in the
  design SVGs are illustrative only and are never copied into the UI.
- Sanctions-proximity scoring stays deferred; the UI must not present it
  as active.
- `GET /feedback/outcomes` has no `case_id` filter; the case detail page
  filters client-side by `case_id`.
