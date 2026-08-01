# Open Issues

Current open work only (no history). Resolutions → `OPEN_ISSUES_LOG.jsonl`.
Roadmap/sequencing → `PLANNING.md`. Product reference → `CONCEPT.md`.

M0–M9 prototype milestones are **done**. §K post-tip hardening is **done**
(soft-delete pre-check, §8.6 eligibility, audit/`include_deleted` gates,
reputation `deletedAt` filter, board-hide on claim metrics, HTTP smoke).

Cloud agents: pick the **highest** unchecked item below that has acceptance
criteria; one issue per turn when possible; keep `pnpm test:smoke` green.

---

## Marathon queue (ordered)

### 1. About / FAQ → living artifacts

- [x] **Migrate About into Canon artifact** — done (`canon-about`, `/about` redirect, `smoke-about`)
- [x] **Migrate FAQ into Canon artifact** — done (`canon-faq`, `/faq` redirect, `smoke-faq`)

### 2. Fixture retirement

- [x] **Retire remaining hardcoded dossier/artifact demo panels** — done
  (`descriptive-artifact` + `red-team-review` deleted; legacy redirects;
  sidebar → Collection; artifact actions from live threads; `smoke-fixture-retirement`)

### 3. Typed Finding / Mitigation posts

- [x] **First-class typed posts on thread timeline** — done
  (`finding`|`mitigation` types; RT-only create gate; composer picker;
  timeline filters + accents; seed finding+mitigation; `smoke-typed-posts`)

### 4. Editor tables (defer images if needed)

- [ ] **Plate tables MVP**
  - **Scope:** add table plugin compatible with Plate 52; toolbar insert;
    DocumentReader + plainTextExport; structural validation allowlist
  - **Done when:** insert/edit simple table in `/test/editor`; round-trip save;
    smoke on content_json shape
  - **Out of scope:** image upload pipeline (separate); keep `.webp`-only until
    upload exists

### 5. Home / About CONCEPT alignment

- [ ] **Home preamble links to live exemplars**
  - **Scope:** `src/app/pages/home.tsx`
  - **Done when:** explicit Canon vs Manuals + thread-first + claims + Red Team
    copy with deep links to e.g. `/collection/collection-us`,
    `/dossier/us-voting-1`, a live RFC thread, Collection dashboard
  - **Verify:** manual; no new smoke required if copy-only

### 6. CONCEPT.md rewrite pass

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
pnpm test:smoke          # must stay green (~43 scripts incl. HTTP gates)
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
  About / FAQ), artifact editor — unify deliberately.
