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
- [ ] **Fumadocs unpin** — stay on 16.5.4 until Tailwind ≥4.3.2 (resolves
  `-inset-s-4`) or prebuilt CSS; then bump `fumadocs-*` and verify `/docs`
- [ ] **Split `server/index.ts` / `server/db.ts`** — quality debt; do only if a
  feature turn is blocked by file size
- [x] **`dist/` gitignore** — done (`.gitignore` + untrack; `smoke-dist-gitignore`)

---

## Toolchain notes for agents

```bash
pnpm install
pnpm run build
pnpm test:smoke          # must stay green (~48 scripts incl. HTTP gates)
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
