# Open Issues

Current open work only (no history). Resolutions → `OPEN_ISSUES_LOG.jsonl`.
Roadmap/sequencing → `PLANNING.md`. Product reference → `CONCEPT.md`.

M0–M9 prototype milestones are **done**. §K post-tip hardening is **done**
(soft-delete pre-check, §8.6 eligibility, audit/`include_deleted` gates,
reputation `deletedAt` filter, board-hide on claim metrics, HTTP smoke).
About + FAQ living Canon artifacts are **done** (`canon-about`, `canon-faq`).
Fixture descriptive + Red Team demo pages are **retired**.
Typed finding/mitigation ThreadPost types are **done** (RT-gated create + smoke).
Plate tables MVP is **done** (`@platejs/table@52`, Inserts → Table, reader/export/smoke).

Cloud agents: pick the **highest** unchecked item below that has acceptance
criteria; one issue per turn when possible; keep `pnpm test:smoke` green.

---

## Marathon queue (ordered)

### 1. Home / About CONCEPT alignment

- [ ] **Home preamble links to live exemplars**
  - **Scope:** `src/app/pages/home.tsx`
  - **Done when:** explicit Canon vs Manuals + thread-first + claims + Red Team
    copy with deep links to e.g. `/collection/collection-us`,
    `/dossier/us-voting-1`, a live RFC thread, Collection dashboard
  - **Verify:** manual; no new smoke required if copy-only

### 2. CONCEPT.md rewrite pass

- [ ] **Editorial pass (human-facing)**
  - Checklist: Area/Collection hierarchy; kill Requirements Matrix framing;
    claims abstraction; bridge soft-label; parent/sub-RFC; evidence section;
    fix dupes/numbering. Not a code milestone — land as a docs PR slice.

---

## Optional / deferred

- [ ] **Image upload pipeline** — after tables; replace `.webp`-only constraint
- [ ] **Manuals 3D globe** — SVG map+list already satisfies CONCEPT
- [ ] **Full OAuth / IdP** — bind session→server actor; body `actor_id` trust
  remains until then (explicit)
- [ ] **Moderator polish** — Canon revert audit; role-change audit; mod queue UI
- [ ] **Model→forecast implication graph** — deferred
- [ ] **Fumadocs unpin** — stay on 16.5.4 until `inset-s-*` or prebuilt CSS
- [ ] **Split `server/index.ts` / `server/db.ts`** — quality debt; do only if a
  feature turn is blocked by file size
- [ ] **`dist/` gitignore** — repo currently tracks build output by convention;
  optional cleanup (large noisy diffs)

---

## Toolchain notes for agents

```bash
pnpm install
pnpm run build
pnpm test:smoke          # must stay green (~44 scripts incl. HTTP gates)
pnpm db:reset            # wipe + reseed local SQLite
```

- API: Hono `:8787` — `GET /api/health`
- Prefer HTTP assertions via `app.request` (`scripts/smoke-http-gates.ts` pattern)
  when changing routes; DB-only smokes miss gate bugs
- No `POST /api/threads` — threads are seed + promote/decide flows
- Continuity: update `OPEN_ISSUES.md` / `PLANNING.md` / `SCRATCHPAD.json` +
  append logs same turn as landing work

---

## Notes

- Lane hygiene and separation of powers remain load-bearing CONCEPT constraints.
- Three content systems: Fumadocs `/docs`, living site artifacts (Charter /
  About / FAQ under `canon-governance-1`), artifact editor — unify deliberately.
