# Open Issues

Current open work only (no history). Resolutions → `OPEN_ISSUES_LOG.jsonl`.
Roadmap/sequencing → `PLANNING.md`. Product reference → `CONCEPT.md`.

M0–M9 prototype milestones are **done**. §K post-tip hardening is **done**.
**R0 residual polish** marathon queue is **done** (About/FAQ artifacts, fixture
retirement, typed posts, Plate tables, home exemplars, CONCEPT rewrite).

Cloud agents: pick the **highest** unchecked item below that has acceptance
criteria; one issue per turn when possible; keep `pnpm test:smoke` green.
When the marathon queue is empty, take the next **Optional / deferred** item
that is actionable, or stop if blocked on product decisions.

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

- [x] **Plate tables MVP** — done (`@platejs/table@52`; toolbar insert;
  DocumentReader + markdown export; structural row/cell checks;
  `smoke-editor-tables`)

### 5. Home / About CONCEPT alignment

- [x] **Home preamble links to live exemplars** — done
  (`#what-is-this` on `/`; Canon/Manuals + lanes + threads/RFC + claims +
  Red Team/Adjudicators; `HOME_EXEMPLARS` → Collection/dossier/thread/RFC/
  finding; `smoke-home-preamble`)

### 6. CONCEPT.md rewrite pass

- [x] **Editorial pass (human-facing)** — done
  (hierarchy tree; kill Requirements Matrix framing; claims = one abstraction /
  two profiles; `lane_soft_label` composite/bridge; leaf vs wrapper RFC table;
  §2.4 evidence pointer + Appendix E; living Charter/About/FAQ; §0–§12
  numbering; `smoke-concept`)

---

## Optional / deferred

- [x] **Image upload pipeline** — done (`POST /api/uploads/images`;
  `GET /uploads/images/:file`; editor Choose image; webp/png/jpeg/gif;
  `smoke-image-upload`; CONCEPT Appendix C residual cleared)
- [ ] **Manuals 3D globe** — SVG map+list already satisfies CONCEPT
- [ ] **Full OAuth / IdP** — bind session→server actor; body `actor_id` trust
  remains until then (explicit)
- [x] **Moderator polish** — done
  - [x] **Canon revert audit** — done (`POST /api/artifacts/:id/revert`;
    Owner-only; Canon-only; parent/target revision; `revert` audit;
    artifact Revert chrome; `smoke-canon-revert`)
  - [x] **Role-change audit** — done (`POST /api/users/:id/roles`;
    `UserRoleAssignment` overrides; effective-user cache for merge/moderation
    gates; `role_change` audit; Collection Role appointment panel;
    `smoke-role-change`)
  - [x] **Mod queue UI** — done (`/mod` soft-deleted posts + open findings +
    adjudication tabs; steward Canon filter; header + Collection audit link;
    `getThread` include_deleted; `smoke-mod-queue`)
- [ ] **Model→forecast implication graph** — deferred
- [x] **Fumadocs unpin** — done (Tailwind/`@tailwindcss/vite` **4.3.3**;
  `fumadocs-ui`/`fumadocs-core` **16.14.0**; `fumadocs-mdx` **14.2.7** kept for
  Vite 6; `-inset-s-4` in build CSS; `smoke-fumadocs`)
- [x] **Split `server/index.ts` / `server/db.ts`** — done
  - First slice: `server/db/{prisma,registries,search,moderationDb,identities}.ts`
    + `server/routes/{health,uploads,corpus,moderation}.ts`
  - Second slice: `server/routes/{threads,claims,findings}.ts` (M5–M7 HTTP)
  - Third slice: `server/routes/artifacts.ts` (artifacts/pages/sections/
    attributions/terms + Canon revert); `server/index.ts` ~64 lines
  - Fourth slice: `server/db/findingsDb.ts` (Findings / Candidates /
    Accepted Risk reads; `createAcceptedRisk` stays in `db.ts` for merge-
    authority deps); `smoke-server-split` asserts module ownership
  - Remaining optional: extract threads/claims/artifacts **db** modules
    from `server/db.ts` (prefer after clarifying circular deps)
- [x] **`dist/` gitignore** — done (`.gitignore` + untrack; `smoke-dist-gitignore`)

---

## Toolchain notes for agents

```bash
pnpm install
pnpm run build
pnpm test:smoke          # must stay green (~53 scripts incl. HTTP gates)
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
