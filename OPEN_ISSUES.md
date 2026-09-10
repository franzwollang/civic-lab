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

### 1. CONCEPT.md rewrite pass

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
- [ ] **Moderator polish** — Canon revert audit; role-change audit; mod queue UI
- [ ] **Model→forecast implication graph** — deferred
- [x] **Fumadocs unpin** — done (Tailwind/`@tailwindcss/vite` **4.3.3**;
  `fumadocs-ui`/`fumadocs-core` **16.14.0**; `fumadocs-mdx` **14.2.7** for Vite 6;
  `smoke-fumadocs`; `-inset-s-4` compiles)
- [x] **Split leaf modules + route registrars** — done
  (`server/db/{prisma,registries,search,moderationDb,identities}`;
  `server/routes/{health,uploads,corpus,moderation}`; barrels stable;
  `smoke-server-split`; suite **50/50**)
- [ ] **Deeper server split (domain db modules)** — route registrars done
  (`server/routes/{artifacts,threads,claims,findings}`; slim `index.ts`);
  still extract `artifactsDb` / `threadsDb` / `claimsDb` / `findingsDb` /
  optionally `corpusDb`; keep `createAcceptedRisk` in `server/db.ts`
- [x] **`dist/` gitignore** — done (`.gitignore` + untrack; `smoke-dist-gitignore`)

---

## Toolchain notes for agents

```bash
pnpm install
pnpm run build
pnpm test:smoke          # must stay green (~50 scripts incl. HTTP gates)
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
