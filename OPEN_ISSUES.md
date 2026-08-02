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
- [ ] **Manuals 3D globe** — **product-gated / do not implement.** SVG map+list
  already satisfies CONCEPT §1.2; keep flat picker unless product explicitly
  asks for WebGL. No acceptance criteria until then.
- [ ] **Reputation-board rollup of implication scores** — **CONCEPT-deferred.**
  §5.2 / §9.2 / §12 keep reputation (labor signals) separate from claim/forecast
  scores; artifact-scoped `scoreModelImplications` is done. No AC until CONCEPT
  specifies attribution (user vs model claim), collection vs cross-collection
  scope, and whether this belongs on claim-metrics vs reputation panels.
- [x] **Full OAuth / IdP (prototype IdP-lite)** — done
  (`POST /api/auth/login|impersonate|logout`, `GET /api/auth/me`;
  httpOnly `civic_lab_session` cookie; mutations + gated reads use
  session actor — body/query `actor_id` no longer trusted;
  header switcher syncs session; `AUTH_MODE=session_with_identity_hooks`;
  `smoke-session-actor` + HTTP smokes updated).
- [x] **External OIDC provider swap-in** — done
  (`GET /api/auth/oidc/status|start|callback`; env
  `OIDC_ISSUER`/`CLIENT_ID`/`CLIENT_SECRET`/`REDIRECT_URI` +
  `OIDC_SUBJECT_MAP`; `OIDC_MOCK=1` for local/smoke; session
  `provider: "oidc"`; same cookie + `requireSessionActor`;
  `smoke-oidc`).
- [x] **OIDC JWKS id_token verify** — done
  (`server/auth/oidcJwks.ts` + `src/lib/oidcJwks.ts`; jose RS/ES verify;
  `OIDC_JWKS_URI` or discovery `jwks_uri`; iss/aud/exp/nonce checks;
  non-mock token path; `smoke-oidc` local RSA + bad-sig + nonce mismatch).
  Real IdP deploy remains ops.
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
- [x] **Model→forecast implication graph (MVP)** — done
  (`implies_forecast` link kind on model claims; create validation;
  composer + claim-list display; seed `claim-canon-enp-model`;
  `smoke-claim-implications`).
- [x] **Model→forecast implication DAG UI** — done
  (`buildImplicationGraph` / `hasImplicationEdges`; read-only
  `ClaimImplicationGraph` on `ArtifactClaimsPanel`; seed triangle on
  `page-001`; `smoke-claim-implication-graph`).
- [x] **Model→forecast implication score propagation** — done
  (`scoreModelImplications` / `scoreModelImplicationsById`; advisory
  Brier/log/skill from resolved implied forecasts onto models; DAG UI
  summary + per-edge contrib; n≥20 public-board gate; seed page-001
  asserts n=1; `smoke-claim-implication-scores`). Reputation-board
  rollup of implication scores still deferred.
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
    authority deps)
  - Fifth slice: `server/db/claimsDb.ts` (Claims CRUD + adjudication queue;
    `smoke-server-split` asserts ownership)
  - Sixth slice: `server/db/artifactsDb.ts` (Artifact CRUD / soft-lane /
    Canon revert / revisions / section sync; barrel + smoke ownership)
  - Seventh slice: `server/db/threadsDb.ts` (Thread/RFC/RevSet/decide/
    merge-authority; `createAcceptedRisk` stays in `db.ts` and imports
    `resolveMergeAuthorityForArtifact`; `smoke-server-split` + editor-mvp
    source markers updated)
  - Eighth slice: `server/db/corpusDb.ts` (Area/Collection/Dossier +
    §11 Collection dashboard/reputation; queries `prisma.thread` directly;
    `createAcceptedRisk` stays in `db.ts`; `smoke-server-split` ownership)
  - Auth slice: `server/auth/session.ts` + `server/routes/auth.ts`
    (session→actor); `db.ts` still hosts `createAcceptedRisk` + barrels
- [x] **`dist/` gitignore** — done (`.gitignore` + untrack; `smoke-dist-gitignore`)

---

## Toolchain notes for agents

```bash
pnpm install
pnpm run build
pnpm test:smoke          # must stay green (~58 scripts incl. HTTP gates)
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
