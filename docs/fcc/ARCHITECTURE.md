# Figure Control Console (FCC) — Architecture Design v0.1

Status: DESIGN. Architecture approved 2026-09-06; no code exists yet. Implementation is gated on the open decisions listed at the end.

Reference material: FIGURE CONTROL v1.0.1, `https://github.com/MaxLee-DirectModels/Figure-Control` (`FIGURE_CONTROL.zip`, manifest fingerprint `sha256:229c9342…`). It is not vendored here yet; slice 3 vendors it under `reference/`.

## Context

FCC is a control plane between an AI's proposals and the world. A proposed action moves through six stages (Configuration → Figuration → Route Field → Control Admission → Production → Refiguration) and the four invariants are the product, not features of it.

The reference is FIGURE CONTROL v1.0.1 (`MaxLee-DirectModels/Figure-Control`, distributed as `FIGURE_CONTROL.zip`). I fetched it, read `README.md`, `FIGURE_CONTROL.md`, all example records, and surveyed the 28-module Python package. What I keep: its record vocabulary (`figure-control.*/1` closed schemas), digest-binding, `EARNED|REJECTED|OPEN`, the Null Route account, the 12 material axes, the compilation-bundle determinism idea, the durable effect lifecycle states, and the hash-chained HMAC journal. What I drop or change: its single-operator posture (no users, no roles, no tenancy), its SQLite file-ownership checks, its POSIX-file-only adapter, the 691-node semantic fabric pin as a runtime dependency, and its placement of the Null-Route check at compile time only (FCC enforces it at the Route Field itself, INV-4).

Repository note: `trsaso.github.io` is a personal GitHub Pages site with no FCC code. FCC lands under a new `fcc/` tree; existing files are untouched. Whether FCC should be its own repo is an open decision (see end).

Invariants, restated:

- **INV-1** No standing transports across a stage without an explicit Passage record. Selected ≠ Authorized ≠ Dispatched ≠ Occurred ≠ Effective ≠ Successful.
- **INV-2** A Control Admission is consumable exactly once, for exactly one operation hash, before expiry. Replay fails at the DB layer.
- **INV-3** Dispositions are exactly `EARNED | REJECTED | OPEN`. OPEN is never coerced to success.
- **INV-4** A Route Field without a Null Route is invalid and cannot reach Control.

Every section ends with **Breaks if wrong**.

---

## 1. Runtime decision: TS core as source of truth, Python reference as cross-validator

**Decision:** Native TypeScript pure core (`@fcc/core`) is the source of truth for transition logic. Postgres is the source of truth for state and enforces INV-2/3/4 with constraints, not application code. The Python reference runtime is vendored, pinned by its manifest digest, and used as a **verifier oracle** that never writes.

**Why not Python-as-source-of-truth behind a service:**

1. The reference has no users, roles, orgs, or separation of duties. Wrapping it means authority is enforced in a wrapper, which is exactly the "application code, not DB layer" failure INV-2 forbids.
2. Its store is SQLite with effective-user file-ownership and `0600` single-link checks (`store.py`). A hosted, multi-tenant Postgres cannot satisfy those, so `store.py` (115 KB) gets rewritten anyway. At that point we own a fork with no type sharing with the console.
3. Its schemas are closed and fail on unknown fields. FCC's Passage carries 14 bindings; the reference Passage carries 17 different keys with no `actor/owner/method/authority/claim_ceiling`. Extending means forking.
4. Its runtime refuses to mint warrants unless `policy.profile_root_digest` equals the semantic-fabric fingerprint. That makes a 378 KB conceptual dictionary a production dependency.

**How the reference is still used (three modes, `FCC_XVAL=required|advisory|off`):**

- Each FCC stage record embeds a reference-shaped record verbatim as `core` (e.g. `figure-control.route-field/1`) and adds an FCC `envelope` (tenancy, actor, passage binding). `fcc_digest = sha256(canonical({core_digest, envelope}))`. The `core` is byte-identical to what the reference validators accept.
- A sidecar `reference/xval/` exposes the reference's **pure** evaluators only (`validate-figure`, `validate-route-field`, `validate-passage`, `validate-null-route`, `validate-refiguration`, `compile-case`, `validate-compilation`). No store, no filesystem adapter, no journal key.
- `required` (prod default): at admission compile, the TS bundle digest must equal the reference's `bundle_digest` for the projected case. Mismatch → admission `REJECTED` with residual `xval:bundle-mismatch`. Reference unavailable → `REJECTED`, never `EARNED`.
- `advisory`: mismatch is journaled as an observation; admission stands on TS alone. `off`: dev only.
- CI: differential suite runs every fixture and every journaled compilation from staging through both and diffs canonical bytes.

**Breaks if wrong:**
- If TS drifts from reference semantics on a path with no fixture, the drift becomes product truth silently in `advisory/off`. Mitigation is coverage, not architecture; hence `required` in prod.
- If canonicalization differs by one byte (Python `json.dumps(sort_keys=True, separators=(",",":"), ensure_ascii=False)` vs JS), every cross-check fails. This is why canonicalization is slice 0 with a golden test against the reference example's known `bundle_digest`.
- If the reference has a bug, FCC inherits false `REJECTED`s (fail-closed, acceptable), never false `EARNED`s (TS must independently earn).
- If Python were chosen instead: SoD lives outside the core, Postgres is impossible without a rewrite, and console types are hand-mirrored.

---

## 2. System architecture

```
                 ┌──────────────────────── edges (I/O) ────────────────────────┐
  Console (UI) → HTTP API (@fcc/server) → auth/authority middleware            │
                        │                                                       │
                        ▼                                                       │
              load aggregate (@fcc/db)  ──►  @fcc/core.transition(state, cmd, ctx)  ──►  {next, journal[], effects[]}
                        │                          (pure; no I/O; time & nonce injected)          │
                        ▼                                                                         ▼
              persist in ONE tx (records + passage + journal append, DB constraints fire)   effect interpreter
                                                                                                  │
                                            ┌─────────────────────────────────────────────────────┤
                                            ▼                    ▼                    ▼            ▼
                                       adapters (worker)   AI drafting (@fcc/drafting)   xval sidecar   anchor publisher
```

### 2.1 Packages

| Package | Role | I/O allowed |
|---|---|---|
| `@fcc/core` | Types (zod), canonical JSON + sha256, dispositions, the six-stage state machine, closure computation, route distinctness, Passage binding, admission compiler | none |
| `@fcc/db` | Migrations, repositories, journal append/verify, SQL-level invariant tests | Postgres |
| `@fcc/server` | HTTP API, sessions, role checks (fast-fail), orchestration, adapter host, xval client | all |
| `@fcc/adapters/*` | One package per adapter kind | per manifest |
| `@fcc/drafting` | Anthropic API drafting assistant → `materials` | Anthropic API |
| `@fcc/templates` | Demand template JSON Schema + built-in templates | none |
| `@fcc/console` | Web UI: case timeline, OPEN ledger, dispatch console, journal verifier | HTTP |
| `reference/` | Vendored Figure Control 1.0.1 + xval shim + differential harness | subprocess |

### 2.2 The state machine

The aggregate is a **Case** (one demand instance). Stage is derived, never stored as the source of truth; it is the latest record kind reachable through committed Passages.

```ts
type Disposition =
  | { kind: 'EARNED' }
  | { kind: 'REJECTED'; code: string; path: string; message: string }
  | { kind: 'OPEN'; residuals: ResidualId[] };            // closed union; no boolean coercion helper exists

type Ctx = { now: Instant; nonce: Hex32; actor: PrincipalRef; templ: DemandTemplate };

type Transition<S, C> = (s: S, c: C, ctx: Ctx) =>
  | { kind: 'EARNED'; next: S; journal: JournalEvent[]; effects: Effect[] }
  | { kind: 'REJECTED'; code; path; message }
  | { kind: 'OPEN'; next: S; residuals: ResidualId[]; journal: JournalEvent[] };
```

Commands (one per crossing plus the intra-Production lifecycle):

| Command | Crossing / edge | Produces | Requires Passage |
|---|---|---|---|
| `DeclareConfiguration` | entry | `configurations` row | no (entry) |
| `FormFigure` | Configuration → Figuration | `figures`, `ground_members` | P1 |
| `OpenRouteField` | Figuration → Route Field | `route_fields`, `routes` (incl. NULL) | P2 |
| `Qualify` | within Route Field | `qualifications`, `predicate_receipts` | no (receipts are evidence, not standing) |
| `CompileAdmission` | Route Field → Control | `control_admissions` (+ bundle) | P3 |
| `Dispatch` | Control → Production | consumes admission; `warrants`, `productions(DISPATCHING)` | P4 |
| `RecordObservation` | Production internal | `receipts(OBSERVATION)`; state → `OBSERVED` / `MAY_HAVE_OCCURRED` | no |
| `Reconcile` | Production internal | `receipts(RECONCILIATION)`; state → `RECONCILED` | no |
| `RecoverStartup` | Production internal | `DISPATCHING→MAY_HAVE_OCCURRED`, `OBSERVED→OPEN` | no |
| `Resolve` | Production internal | `receipts(RESOLUTION)`; state → `RESOLVED` | no |
| `Refigure` | Production → Refiguration | `refigurations`, `successors`, `residuals` | P5 |
| `Succeed` | Refiguration → Configuration | new `configurations` (successor) | P6 |

Effects are data: `{kind:'DISPATCH', adapterId, warrant, operation}`, `{kind:'XVAL_COMPILE', case}`, `{kind:'DRAFT', prompt}`. The server interprets them after the transaction commits; their results re-enter as new commands. Nothing inside `transition()` touches a clock, the network, or randomness.

Property tests (fast-check) assert: for every transition, an `OPEN` input disposition on any bound record yields `OPEN` or `REJECTED`, never `EARNED`; every `EARNED` output has a Passage in `journal[]`; no command is accepted on a Case whose latest record is `OPEN` except `Resolve`/`Refigure`.

**Breaks if wrong:** If any I/O leaks into `transition()` (a `Date.now()`, a repository call), determinism dies and the xval cross-check and replay-from-journal both become impossible. Enforced by an ESLint restricted-imports rule on `@fcc/core` and by running the core in a Node `vm` with no globals in tests.

---

## 3. Database schema (Postgres 16)

Conventions: ids are UUIDv7 `uuid`. Every record table has `org_id`, `body jsonb` (the full closed record), `canonical_text text` (exact canonical bytes), `digest text` with `CHECK (digest = 'sha256:' || encode(digest(canonical_text::bytea,'sha256'),'hex'))` via pgcrypto, `created_by`, `created_at`. Records are **immutable**: `BEFORE UPDATE` triggers raise on every record table except for the specific consumption/state columns named below. Row-level security by `org_id`. The app role `fcc_app` has `INSERT/SELECT` only; the few mutations that exist go through `SECURITY DEFINER` functions.

### 3.1 Identity and authority

```sql
organizations(id, name, created_at)
users(id, org_id, email UNIQUE(org_id,email), display_name, created_at, disabled_at)
service_accounts(id, org_id, name, kind CHECK (kind IN ('AI_AGENT','INTEGRATION')), created_by, created_at, disabled_at)
principals -- view: users ∪ service_accounts as (id, org_id, kind: 'USER'|'AI_AGENT'|'INTEGRATION')

role_grants(id, org_id, principal_id, principal_kind, role, scope jsonb, granted_by, granted_at, revoked_at, revoked_by,
  CHECK (role IN ('OWNER','AUTHOR','QUALIFIER','ADMITTER','DISPATCHER','RESOLVER','AUDITOR','ADAPTER_ADMIN')),
  CHECK (principal_kind <> 'AI_AGENT' OR role = 'AUTHOR'),          -- AI can only author material
  CHECK (principal_kind <> 'INTEGRATION' OR role IN ('AUTHOR','DISPATCHER')))
-- fcc_has_role(principal, org, role, at) SQL function used by triggers below.

authority_grants(id, org_id, issuer_id, principal_id, authority_basis text[], intents text[], operations text[],
  adapter_id, target_prefix, issued_at, not_before, commit_deadline, effect_deadline, max_uses int,
  resource_limits jsonb, claim_ceiling text[], uses_consumed int DEFAULT 0, revoked_at, revoked_by,
  body, canonical_text, digest,
  CHECK (issued_at <= not_before AND not_before < commit_deadline AND commit_deadline <= effect_deadline),
  CHECK (uses_consumed <= max_uses),
  CHECK (cardinality(claim_ceiling) > 0))
-- trigger: issuer must hold ADMITTER or OWNER; issuer <> principal; adapter must be enabled for org at issue time.
```

### 3.2 Demand templates and demands

```sql
demand_templates(id, org_id NULL /* NULL = global */, key, version int, body jsonb, digest, published_by, published_at, disabled_at,
  UNIQUE (org_id, key, version))
demands(id, org_id, case_id, template_id, template_digest, free_text, parameters jsonb, requested_by, created_at)
cases(id, org_id, demand_id, created_by, created_at)   -- aggregate root; stage derived by view fcc_case_stage
```

### 3.3 Stage records

```sql
configurations(id, org_id, case_id, view CHECK (view IN ('BASELINE','INTENDED','REPORTED','EFFECTIVE')),
  frame, boundary, resolution, observed_at, predecessor_passage_id NULL REFERENCES passages(id),
  origin CHECK (origin IN ('HUMAN','AI_DRAFT','ADAPTER_OBSERVATION','SUCCESSOR')), source_material_id NULL,
  body, canonical_text, digest, created_by, created_at)
configuration_members(configuration_id, member_id, kind, attributes jsonb, PRIMARY KEY (configuration_id, member_id))
dependency_edges(configuration_id, dependent, dependency, kind CHECK (kind IN ('CONSTITUTIVE','CONSTRAINING','CONDITIONING','RESOURCE','AUTHORITY')),
  result_changing bool, basis text[], PRIMARY KEY (configuration_id, dependent, dependency, kind))

figures(id, org_id, case_id, configuration_id, configuration_digest, passage_id NOT NULL REFERENCES passages(id),
  figure_label, address, use, criterion, frame, boundary, resolution,
  figure_members text[] CHECK (cardinality(figure_members) > 0),
  closure_members text[], background_remainder text[],
  closure_disposition CHECK (closure_disposition IN ('EARNED','REJECTED','OPEN')), closure_residuals text[],
  search_receipts text[] CHECK (cardinality(search_receipts) > 0), stopping_rule,
  origin, source_material_id, body, canonical_text, digest, created_by, created_at,
  CHECK (closure_disposition <> 'EARNED' OR cardinality(closure_residuals) = 0),
  CHECK (closure_disposition <> 'OPEN' OR cardinality(closure_residuals) > 0))
ground_members(figure_id, member_id, role CHECK (role IN ('FIGURE','SUPPORTING_GROUND','BACKGROUND')), depth int, via_edges jsonb,
  PRIMARY KEY (figure_id, member_id))
-- Dependency closure at the DB layer:
--   fcc_closure(configuration_id, figure_members[]) = recursive CTE over dependency_edges WHERE result_changing.
--   BEFORE INSERT ON figures: closure_members must equal fcc_closure(...) exactly, and
--   figure_members ∪ closure_members ∪ background_remainder must equal configuration_members exactly, disjointly;
--   otherwise RAISE 'FIGURE_CLOSURE_MISMATCH'. AFTER INSERT materializes ground_members.

route_fields(id, org_id, case_id, figure_id, figure_digest, passage_id NOT NULL REFERENCES passages(id),
  configuration_id, demand, boundary, horizon, search_scope jsonb, search_receipts text[] CHECK (cardinality(search_receipts) > 0),
  equivalence_merges jsonb, completeness_disposition CHECK (... IN ('EARNED','REJECTED','OPEN')), completeness_residuals text[],
  null_route_id uuid NOT NULL, null_route_kind text NOT NULL DEFAULT 'NULL' CHECK (null_route_kind = 'NULL'),
  origin, source_material_id, body, canonical_text, digest, created_by, created_at,
  FOREIGN KEY (null_route_id, id, null_route_kind) REFERENCES routes(id, route_field_id, kind) DEFERRABLE INITIALLY DEFERRED)
routes(id, route_field_id REFERENCES route_fields(id) DEFERRABLE INITIALLY DEFERRED,
  route_label, kind CHECK (kind IN ('ACTION','NULL')),
  mode CHECK (mode IN ('ACT','TRANSFORM','INTRODUCE','COPY','SPLIT','MERGE','TERMINATE','WAIT','HOLD','REFUSE','PRESERVE')),
  material_differences text[] CHECK (cardinality(material_differences) > 0 AND material_differences <@ ARRAY[
    'operation-class','authority','protected-condition','external-effect','irreversibility','dependency-topology',
    'information-state','horizon-or-timing','successor-set','recovery-or-exit','burden-class','future-capacity']),
  axis_signature text NOT NULL,                       -- sha256 of per-axis values; computed by core
  decision_points text[], implementation_digest text, basis text[],
  null_account jsonb,                                 -- the 22-key figure-control.null-route/1 record when kind='NULL'
  body, canonical_text, digest,
  UNIQUE (id, route_field_id, kind),
  UNIQUE (route_field_id, axis_signature),            -- two routes with no material difference cannot coexist
  CHECK ((kind = 'ACTION') = (implementation_digest IS NOT NULL)),
  CHECK ((kind = 'NULL') = (null_account IS NOT NULL)),
  CHECK (kind <> 'NULL' OR mode IN ('WAIT','HOLD','REFUSE','PRESERVE')),
  CHECK (kind <> 'ACTION' OR mode NOT IN ('WAIT','HOLD','REFUSE','PRESERVE')))
```

**INV-4 at the DB layer.** The circular deferrable FK means a `route_fields` row cannot be committed unless a `routes` row with `kind='NULL'` belonging to that field exists. `control_admissions.route_field_id` is a normal FK, so Control cannot reference a field that lacks one. The core also checks it first (so the error is a typed `REJECTED`, not a constraint violation), and the compile step additionally refuses to select a NULL route for effect (`NONACTION_EXECUTION`, as in the reference).

```sql
qualifications(id, org_id, case_id, subject_kind, subject_id, subject_digest, profile jsonb, completion_rule jsonb,
  disposition CHECK (...), residuals text[], first_breaks text[], job_digest, qualified_by, issued_at, current_until,
  body, canonical_text, digest, CHECK (current_until > issued_at))
predicate_receipts(id, qualification_id, predicate, purpose, subject, input_digests text[], method, criterion, basis text[],
  configuration_id, issued_at, current_until, carrier_kind CHECK (carrier_kind IN ('RESULT','WITHHELD','OPEN','REJECTED')),
  carrier jsonb, claim_ceiling text[], job_digest, issued_by, digest,
  CHECK (current_until > issued_at))
-- trigger: issued_by must hold QUALIFIER; issued_by <> the case's figure.created_by (author ≠ qualifier).
-- job_digest = sha256(canonical({predicate,purpose,subject,input_digests,method,criterion,configuration_id})) recomputed and compared.

control_admissions(id, org_id, case_id, route_field_id NOT NULL REFERENCES route_fields(id), figure_digest, route_field_digest,
  passage_id NOT NULL REFERENCES passages(id), qualification_id, qualification_digest,
  grant_id REFERENCES authority_grants(id), grant_digest,
  selected_route_id REFERENCES routes(id), null_route_id REFERENCES routes(id),
  operation_hash text NOT NULL, adapter_id, operation, target, principal_id, intent, horizon,
  payload_digest, protected_conditions_digest, resource_claims_digest, predicted_successors text[],
  issued_at, expires_at, token_hash text NOT NULL UNIQUE,
  consumed_at timestamptz, consumed_operation_hash text, consumed_by_production_id uuid,
  revoked_at, revoked_by,
  disposition CHECK (...), residuals text[], compilation_receipt jsonb, bundle_digest, xval_bundle_digest,
  compiled_by, body, canonical_text, digest,
  UNIQUE (id, operation_hash),
  CHECK (expires_at > issued_at),
  CHECK (consumed_at IS NULL OR consumed_at < expires_at),
  CHECK (consumed_operation_hash IS NULL OR consumed_operation_hash = operation_hash),
  CHECK ((consumed_at IS NULL) = (consumed_operation_hash IS NULL) AND (consumed_at IS NULL) = (consumed_by_production_id IS NULL)),
  CHECK (disposition <> 'EARNED' OR cardinality(residuals) = 0))
-- trigger: compiled_by holds ADMITTER; compiled_by <> qualifications.qualified_by; compiled_by <> grant.principal_id;
--          adapter enabled for org; expires_at <= grant.commit_deadline; expires_at <= min(receipt.current_until) over the 8 execution receipts.

warrants(id, admission_id UNIQUE REFERENCES control_admissions(id), production_id, bindings jsonb, before_state_digest,
  nonce text UNIQUE, key_id, hmac, issued_at, effect_deadline, body, canonical_text, digest)

productions(id, org_id, case_id, admission_id uuid NOT NULL UNIQUE, operation_hash text NOT NULL, adapter_id,
  state CHECK (state IN ('DISPATCHING','MAY_HAVE_OCCURRED','OBSERVED','RECONCILED','OPEN','RESOLVED','REFUSED')),
  dispatched_by, dispatched_at, before_state_digest, state_changed_at, determination CHECK (determination IN ('EFFECT_ACCOUNTED','OCCURRENCE_EXCLUDED','UNRESOLVED')),
  resolution_receipt_id,
  FOREIGN KEY (admission_id, operation_hash) REFERENCES control_admissions(id, operation_hash))
-- 'PREPARED' is never durable (reference §10). State edges enforced by trigger table fcc_production_edges:
--   DISPATCHING → MAY_HAVE_OCCURRED | OBSERVED | OPEN | REFUSED
--   MAY_HAVE_OCCURRED → OPEN | RESOLVED
--   OBSERVED → RECONCILED | OPEN
--   OPEN → RESOLVED
--   RECONCILED, RESOLVED, REFUSED terminal. Nothing edges into RECONCILED except OBSERVED. RESOLVED requires resolution_receipt_id.
-- dispatched_by must hold DISPATCHER and equal the grant principal; dispatched_by <> admission.compiled_by.

receipts(id, org_id, production_id, kind CHECK (kind IN ('DRY_RUN','DISPATCH','OBSERVATION','EFFECT','SUCCESS','RECONCILIATION','RESOLUTION')),
  adapter_id, adapter_attestation jsonb, adapter_key_id, before_digest, after_digest, observed_at, observer_id,
  criterion, method, claim_ceiling text[], disposition CHECK (...), residuals text[],
  body, canonical_text, digest, server_hmac, server_key_id)
-- INV-1 inside Production: DISPATCH (dispatched), OBSERVATION (occurred), EFFECT (effective under criterion), SUCCESS (successful under demand criterion)
-- are four separate rows with four separate dispositions. No column or view derives one from another.
-- SUCCESS receipts may only be inserted by a human RESOLVER/QUALIFIER during Refiguration, never by an adapter (trigger on observer kind).

refigurations(id, org_id, case_id, production_id NULL, mode CHECK (mode IN ('PROSPECTIVE','OBSERVED')), before_figure_id,
  passage_id NOT NULL REFERENCES passages(id), disposition, residuals text[], basis text[], body, canonical_text, digest, created_by,
  CHECK (mode <> 'OBSERVED' OR production_id IS NOT NULL))
successors(id, refiguration_id, branch_label, successor_configuration_id REFERENCES configurations(id), after_figure_id,
  correspondences jsonb, ground_effects jsonb, receipt_digests text[], support jsonb,
  classification CHECK (classification IN ('PLANNED_REFIGURATION','PLANNED_MAINTENANCE','REFIGURATION','MAINTENANCE','OPEN','REJECTED')),
  disposition, residuals text[], digest,
  CHECK (mode_of_parent() <> 'PROSPECTIVE' OR cardinality(receipt_digests) = 0),        -- via trigger
  CHECK (disposition <> 'EARNED' OR mode_of_parent() <> 'OBSERVED' OR cardinality(receipt_digests) > 0))
-- trigger: every before-Figure member and after-Figure member appears exactly once across correspondences (RETAIN|INTRODUCE|COPY|SPLIT|MERGE|TRANSFORM|TERMINATE);
--          every Ground member exactly once in ground_effects (RETAIN|INTRODUCE|TRANSFORM|TERMINATE). Else RAISE 'REFIGURATION_ACCOUNT_INCOMPLETE'.

residuals(id, org_id, case_id, owner_kind, owner_id, residual_key, description, opened_at, opened_by_record_digest,
  closed_by_record_kind, closed_by_record_id, closed_at, UNIQUE (owner_kind, owner_id, residual_key))
-- The OPEN ledger. A residual closes only when a NEW record references it; the trigger refuses closing by UPDATE without closed_by_record_id.
open_items -- view: residuals WHERE closed_at IS NULL, joined to case and stage.

materials(id, org_id, case_id, kind CHECK (kind IN ('CONFIGURATION','FIGURE','GROUND','ROUTE_FIELD','NULL_ROUTE','REFIGURATION_PLAN')),
  body jsonb, model_id, request_digest, response_digest, params jsonb, produced_at, produced_by_service_account_id,
  standing text NOT NULL DEFAULT 'MATERIAL' CHECK (standing = 'MATERIAL'),
  promoted_to_kind, promoted_to_id, promoted_by, promoted_at)
-- No disposition column exists on materials. See §7.

record_index(digest PRIMARY KEY, kind, id, org_id)   -- maintained by AFTER INSERT triggers on every record table; passages.evidence must resolve here.

adapter_registrations(org_id, adapter_id, manifest jsonb, manifest_digest, enabled bool NOT NULL DEFAULT false,
  enabled_by, enabled_at, allowed_operations text[], target_prefix, attestation_key_id, PRIMARY KEY (org_id, adapter_id),
  CHECK (enabled = false OR (enabled_by IS NOT NULL AND enabled_at IS NOT NULL)))
```

### 3.4 INV-2 at the DB layer

```sql
REVOKE UPDATE ON control_admissions FROM fcc_app;      -- the app cannot touch consumption columns directly

CREATE FUNCTION fcc_consume_admission(p_id uuid, p_hash text, p_production uuid, p_now timestamptz, p_token_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE n int; tol interval := (SELECT clock_tolerance FROM fcc_settings);
BEGIN
  IF abs(extract(epoch FROM (clock_timestamp() - p_now))) > extract(epoch FROM tol) THEN
    RAISE EXCEPTION 'CLOCK_SKEW';                       -- app clock and DB clock must agree
  END IF;
  UPDATE control_admissions
     SET consumed_at = p_now, consumed_operation_hash = p_hash, consumed_by_production_id = p_production
   WHERE id = p_id AND operation_hash = p_hash AND token_hash = p_token_hash
     AND consumed_at IS NULL AND revoked_at IS NULL
     AND expires_at > p_now AND expires_at > clock_timestamp()
     AND disposition = 'EARNED';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'ADMISSION_CONSUMPTION' USING ERRCODE = 'P0002'; END IF;
END $$;

CREATE TRIGGER admissions_immutable BEFORE UPDATE ON control_admissions FOR EACH ROW
  EXECUTE FUNCTION fcc_raise_if(OLD.consumed_at IS NOT NULL, 'ADMISSION_IMMUTABLE_AFTER_CONSUMPTION');
```

Four independent DB facts must all hold for a dispatch: the conditional `UPDATE` matched exactly one row; `productions.admission_id` is `UNIQUE`; the composite FK `(admission_id, operation_hash)` exists on `control_admissions`; and the immutability trigger forbids a second update. A replay fails on the first; an edited operation fails on the FK; a race fails on the row lock; a privileged app bug cannot bypass because the app role has no `UPDATE`. The consume, the warrant insert, the production insert, the grant `uses_consumed` increment, and the journal append are one transaction (`BEGIN ... COMMIT`, `pg_advisory_xact_lock` on the target key for the target lock).

### 3.5 INV-3 at the DB layer

- Every `disposition` column has `CHECK (disposition IN ('EARNED','REJECTED','OPEN'))`.
- Dispositions are immutable on the row (`BEFORE UPDATE` trigger raises if `OLD.disposition IS DISTINCT FROM NEW.disposition`). New standing needs a new record and a new Passage.
- `EARNED ⇒ residuals = {}`; `OPEN ⇒ residuals ≠ {}` (`CHECK`s).
- A record may be `EARNED` only if its inbound `passages.disposition = 'EARNED'` (trigger).
- `productions.state = 'RECONCILED'` requires an `OBSERVATION` receipt with `after_digest = admission.payload_digest` and an `EFFECT` receipt with `EARNED` (trigger). `RESOLVED` with `EFFECT_ACCOUNTED` requires an observed target digest equal to the admitted payload; `OCCURRENCE_EXCLUDED` requires equality with `before_state_digest`; `UNRESOLVED` stays `OPEN`.

### 3.6 Append-only hash-chained journal

```sql
journal(seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, org_id, org_seq bigint, ts timestamptz, kind, actor_id,
  subject_kind, subject_id, record_digest, payload jsonb, canonical_text text, prev_hash text, hash text, key_id, hmac text,
  UNIQUE (org_id, org_seq))
REVOKE INSERT, UPDATE, DELETE ON journal FROM fcc_app;
CREATE TRIGGER journal_append_only BEFORE UPDATE OR DELETE ON journal FOR EACH ROW EXECUTE FUNCTION fcc_raise('JOURNAL_APPEND_ONLY');
-- fcc_journal_append(kind, subject, payload, canonical_text, hmac, key_id) SECURITY DEFINER:
--   pg_advisory_xact_lock(hashtext('fcc-journal'))       -- one appender at a time keeps the chain linear
--   prev := (SELECT hash FROM journal ORDER BY seq DESC LIMIT 1) or ZERO_HEAD
--   hash := 'sha256:' || encode(digest(prev || canonical_text, 'sha256'),'hex')   -- computed IN the DB from bytes the app supplied
--   INSERT ...
journal_anchors(id, seq, hash, anchored_at, location text, external_receipt jsonb, signature)  -- head copies kept OUTSIDE this DB
```

The hash is computed in the DB from the supplied canonical bytes; the HMAC is computed by the server with a key held in KMS, never in the DB. `fcc verify-journal --anchor <file>` re-derives every hash and HMAC, checks `seq` contiguity, and requires the latest independently retained anchor to be a prefix.

**Breaks if wrong (schema-level):**
- If the app role ever gets `UPDATE` on `control_admissions` or `INSERT` on `journal` (a lazy migration), INV-2 and the chain fall back to application discipline. A migration test asserts the grants.
- If the composite FK is replaced by a plain FK "for simplicity", an edited operation dispatches under a valid admission id.
- If the null-route FK is made non-deferrable, inserts become impossible; if made nullable, INV-4 is gone. A pgTAP test inserts a field with no NULL route and must fail at `COMMIT`.
- If the DB moves to a multi-primary or eventually consistent store, the conditional `UPDATE` no longer serializes and INV-2 breaks silently. Single writer is a hard requirement; document it in ADR-003.
- Journal append serialization is a throughput ceiling. Acceptable for a control plane; if it ever isn't, shard the chain per org (the `org_seq` column exists for that), never remove the lock.

---

## 4. The Passage model

A Passage is the only thing that carries standing across a stage. FCC's Passage is the reference's `figure-control.passage/1` record embedded as `core` (for the crossings where the reference has one) plus a binding envelope carrying the fourteen bindings you listed. Every binding is a `NOT NULL` column.

| Binding | Columns | Meaning | Missing or invalid ⇒ |
|---|---|---|---|
| source | `source_kind, source_id, source_digest` | The record being crossed from | `PASSAGE_SOURCE_UNBOUND`; digest ≠ live record ⇒ `PASSAGE_SOURCE_STALE` |
| context | `configuration_id, configuration_digest` | The Configuration under which the crossing holds | `PASSAGE_CONTEXT_UNBOUND` |
| time | `issued_at, current_until, context_observed_at` | Validity window; consumption outside it fails in `fcc_consume_admission` | `PASSAGE_WINDOW_INVALID` (`CHECK current_until > issued_at`) |
| actor | `actor_id` | Who performs the crossing (the reference's `carrier`) | `PASSAGE_ACTOR_UNBOUND`; lacks required role ⇒ `AUTHORITY_ROLE_MISSING` |
| owner | `owner_id` | Decision owner accountable for the destination stage | `PASSAGE_OWNER_UNBOUND`; `owner = actor` on P3/P4 ⇒ `SEPARATION_OF_DUTIES` |
| form | `mode, orientation` | Transition kind and direction (`FORWARD`, `CORRECTION`) | `PASSAGE_MODE` (must be in the closed mode set and agree with the selected route and the successor transition) |
| criterion | `criterion` | The criterion under which the crossing is judged | must equal the destination's criterion, else `PASSAGE_CRITERION_MISMATCH` |
| destination | `destination_kind, destination_content_digest` | The record being created; the destination row carries `passage_id` back | trigger: destination's content digest must equal this, else `PASSAGE_DESTINATION_MISMATCH` |
| use | `use` | The declared use | must equal the Figure's `use` |
| horizon | `horizon` | Time horizon of the claim | must equal the Route Field / admission horizon |
| evidence | `evidence_digests text[]` | Receipts and records this crossing rests on | `CHECK cardinality > 0`; each must exist in `record_index` (trigger) |
| method | `method` | How the evidence was produced | from the template vocabulary, else `PASSAGE_METHOD_UNKNOWN` |
| authority | `authority_kind, authority_id, authority_digest` | `ROLE_GRANT` for P1/P2/P5/P6; `AUTHORITY_GRANT` for P3/P4 | must be active at `issued_at`; for P4 must admit the operation (`grant.admits()` port) |
| claim ceiling | `claim_ceiling text[]` | The most the destination may claim | `CHECK cardinality > 0`; destination ceiling ⊄ passage ceiling ⇒ `CLAIM_CEILING_EXCEEDED`; passage ceiling ⊄ authority ceiling ⇒ same |

Plus `crossing` (`P1_CONFIGURATION_TO_FIGURATION … P6_REFIGURATION_TO_CONFIGURATION`), `disposition`, `residuals`, `core jsonb` (the reference record, present for P3 and P4), `body`, `canonical_text`, `digest`.

**How a missing binding blocks the crossing, in layers:**

1. `@fcc/core` zod schema: absent key → `REJECTED{code:'FIELD_MISSING', path}` (fail-closed, same as the reference's `require_exact_keys`; unknown keys also fail).
2. `@fcc/core` `bindPassage()`: semantic checks (stale digest, window, SoD, role, ceiling containment, mode agreement) → typed `REJECTED`.
3. DB: `NOT NULL`, `CHECK`s, the evidence-resolves trigger, the destination-digest trigger, the role/SoD triggers.
4. Structural: every downstream record has `passage_id NOT NULL` with a trigger asserting `passages.crossing` is the right one for that table and `passages.source_digest` equals the record's declared upstream digest. A record without a Passage cannot exist; a Passage pointing at the wrong source cannot be referenced.
5. Standing: a destination can be `EARNED` only if its Passage is `EARNED`. An `OPEN` Passage yields an `OPEN` destination with the Passage's residuals copied into the ledger.

No digest cycle: the Passage binds the destination's *content* digest (computed by the pure core before either row exists); the destination's own digest covers its content plus `passage_digest`.

**Breaks if wrong:** If any downstream table's `passage_id` is nullable, standing leaks (INV-1). If the Passage bound the destination by id instead of content digest, a later "same id, different content" insert would inherit standing. If SoD were checked only in the server, a single compromised session with two roles crosses P3 and P4 alone; the DB trigger checks `actor <> owner` and `compiled_by <> qualified_by <> dispatched_by` regardless of the caller.

---

## 5. Demand template format

Templates make a domain data. Schema id `fcc.demand-template/1` (JSON Schema draft 2020-12). Full schema lives in `packages/templates/schema/demand-template.schema.json`; this is the shape:

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "fcc.demand-template/1",
  "type": "object", "additionalProperties": false,
  "required": ["schema_version","key","version","title","vocabulary","figuration","route_field","qualification","control","production","refiguration","authority","drafting"],
  "properties": {
    "schema_version": { "const": "fcc.demand-template/1" },
    "key": { "type": "string", "pattern": "^[a-z][a-z0-9]*(?:[-:._][a-z0-9]+)*$" },
    "version": { "type": "integer", "minimum": 1 },
    "title": { "type": "string" },
    "description": { "type": "string" },
    "vocabulary": {                       // closed id sets; every id used elsewhere must come from here
      "type": "object", "additionalProperties": false,
      "required": ["member_kinds","dependency_kinds","criteria","methods","uses","horizons","claim_ceilings","intents"],
      "properties": {
        "member_kinds":     { "type": "array", "items": { "$ref": "#/$defs/id" }, "minItems": 1 },
        "dependency_kinds": { "type": "array", "items": { "enum": ["CONSTITUTIVE","CONSTRAINING","CONDITIONING","RESOURCE","AUTHORITY"] } },
        "criteria":  { "type": "array", "items": { "$ref": "#/$defs/id" }, "minItems": 1 },
        "methods":   { "type": "array", "items": { "$ref": "#/$defs/id" }, "minItems": 1 },
        "uses":      { "type": "array", "items": { "$ref": "#/$defs/id" }, "minItems": 1 },
        "horizons":  { "type": "array", "items": { "$ref": "#/$defs/id" }, "minItems": 1 },
        "claim_ceilings": { "type": "array", "items": { "$ref": "#/$defs/id" }, "minItems": 1 },
        "intents":   { "type": "array", "items": { "$ref": "#/$defs/id" }, "minItems": 1 }
      }
    },
    "configuration": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "member_schema": { "$ref": "#/$defs/jsonSchema" },          // per-member attributes
        "required_views": { "type": "array", "items": { "enum": ["BASELINE","INTENDED","REPORTED","EFFECTIVE"] } }
      }
    },
    "figuration": {
      "type": "object", "additionalProperties": false, "required": ["default_criterion","default_use","stopping_rules"],
      "properties": {
        "default_criterion": { "$ref": "#/$defs/id" }, "default_use": { "$ref": "#/$defs/id" },
        "stopping_rules": { "type": "array", "items": { "$ref": "#/$defs/id" }, "minItems": 1 },
        "max_closure_depth": { "type": "integer", "minimum": 1 }
      }
    },
    "route_field": {
      "type": "object", "additionalProperties": false, "required": ["required_null_types","min_action_routes"],
      "properties": {
        "required_null_types": { "type": "array", "minItems": 1, "items": { "enum": ["PROTECTIVE_STASIS","DELAY","WAIT","PAUSE","REFUSAL","ABSTENTION","PRESERVATION","FORCED_NONACTION","CAPTURED_NONACTION","DEGRADING_NONACTION","OPTION_WAIT","THRESHOLD_WAIT","COORDINATION_WAIT","PRODUCTIVE_WAIT","SUCCESSOR_HOLD"] } },
        "min_action_routes": { "type": "integer", "minimum": 1 },
        "material_axes_required": { "type": "array", "items": { "$ref": "#/$defs/materialAxis" } },
        "stopping_rules": { "type": "array", "items": { "$ref": "#/$defs/id" } }
      }
    },
    "qualification": {
      "type": "object", "additionalProperties": false, "required": ["axes","completion_rule"],
      "properties": {
        "axes": { "type": "array", "minItems": 1, "items": {
          "type": "object", "additionalProperties": false, "required": ["predicate","carrier_acceptance"],
          "properties": {
            "predicate": { "$ref": "#/$defs/id" },                               // default set: the reference's 8 execution axes
            "carrier_acceptance": { "type": "array", "items": { "enum": ["result","withheld"] }, "minItems": 1 },
            "depends_on": { "type": "array", "items": { "$ref": "#/$defs/id" } },
            "must_be_human": { "type": "boolean", "default": true }
          } } },
        "completion_rule": { "type": "object", "required": ["mode"], "properties": { "mode": { "enum": ["ALL","ANY","K_OF_N"] }, "k": { "type": "integer" } } },
        "max_receipt_validity": { "$ref": "#/$defs/duration" }
      }
    },
    "control": {
      "type": "object", "additionalProperties": false, "required": ["operations","max_admission_validity"],
      "properties": {
        "operations": { "type": "array", "minItems": 1, "items": {
          "type": "object", "additionalProperties": false, "required": ["operation","adapter_kinds","payload_schema","protected_conditions_schema","reversibility","external_effect"],
          "properties": {
            "operation": { "$ref": "#/$defs/id" },
            "adapter_kinds": { "type": "array", "items": { "enum": ["DRY_RUN","WEBHOOK","SANDBOXED_SHELL","MCP_TOOL","HUMAN_ONLY"] } },
            "payload_schema": { "$ref": "#/$defs/jsonSchema" },                 // operation_hash is over canonical(payload ∪ target ∪ conditions)
            "protected_conditions_schema": { "$ref": "#/$defs/jsonSchema" },
            "resource_units": { "type": "array", "items": { "$ref": "#/$defs/id" } },
            "reversibility": { "enum": ["IRREVERSIBLE","REVERSIBLE","IDEMPOTENT"] },
            "external_effect": { "type": "boolean" },
            "requires_before_state": { "type": "boolean", "default": true }
          } } },
        "max_admission_validity": { "$ref": "#/$defs/duration" },
        "require_xval": { "type": "boolean", "default": true }
      }
    },
    "production": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "observation": { "enum": ["EXACT","HUMAN_ATTESTED","NONE"] },
        "effect_criterion": { "$ref": "#/$defs/id" },                 // what "Effective" means here
        "success_criterion": { "$ref": "#/$defs/id" }                 // what "Successful" means here (human-issued receipt)
      }
    },
    "refiguration": {
      "type": "object", "additionalProperties": false, "required": ["prospective_required"],
      "properties": {
        "prospective_required": { "type": "boolean", "default": true },
        "expected_successor_kinds": { "type": "array", "items": { "enum": ["INTRODUCE","RETAIN","COPY","SPLIT","MERGE","TRANSFORM","TERMINATE"] } },
        "reopen_route_field": { "type": "boolean", "default": true }
      }
    },
    "authority": {
      "type": "object", "additionalProperties": false, "required": ["min_distinct_actors","passage_roles"],
      "properties": {
        "min_distinct_actors": { "type": "integer", "minimum": 2, "maximum": 4 },
        "passage_roles": { "type": "object", "additionalProperties": false,
          "properties": { "P1": {"$ref":"#/$defs/roles"}, "P2": {"$ref":"#/$defs/roles"}, "P3": {"$ref":"#/$defs/roles"}, "P4": {"$ref":"#/$defs/roles"}, "P5": {"$ref":"#/$defs/roles"}, "P6": {"$ref":"#/$defs/roles"} } },
        "grant_max_uses": { "type": "integer", "minimum": 1 },
        "independent_first": { "enum": ["required","optional","off"], "default": "optional" }
      }
    },
    "drafting": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "enabled": { "type": "boolean", "default": false },
        "model": { "type": "string", "default": "claude-opus-5" },
        "system_prompt_fragment": { "type": "string" },
        "examples": { "type": "array", "items": { "type": "object" } },
        "may_draft": { "type": "array", "items": { "enum": ["CONFIGURATION","FIGURE","GROUND","ROUTE_FIELD","NULL_ROUTE","REFIGURATION_PLAN"] } }
      }
    }
  },
  "$defs": {
    "id": { "type": "string", "pattern": "^[a-z][a-z0-9]*(?:[-:._][a-z0-9]+)*$", "maxLength": 256 },
    "duration": { "type": "object", "required": ["amount","unit"], "properties": { "amount": { "type": "integer", "minimum": 1 }, "unit": { "enum": ["second","minute","hour","day"] } } },
    "materialAxis": { "enum": ["operation-class","authority","protected-condition","external-effect","irreversibility","dependency-topology","information-state","horizon-or-timing","successor-set","recovery-or-exit","burden-class","future-capacity"] },
    "roles": { "type": "array", "minItems": 1, "items": { "enum": ["OWNER","AUTHOR","QUALIFIER","ADMITTER","DISPATCHER","RESOLVER"] } },
    "jsonSchema": { "type": "object" }
  }
}
```

Templates are versioned and digest-pinned on every demand; a case never re-reads a newer template. Built-in templates ship for `file-write` (mirrors the reference example), `http-webhook-call`, and `human-task`.

**Breaks if wrong:** If vocabulary sets are open, Passage `criterion/method/use` become free text and the "must equal the destination's criterion" checks stop meaning anything. If `min_distinct_actors` could be 1, SoD is off by data. If `payload_schema` is loose, two payloads that differ in an ignored field hash identically and the operation hash no longer names one operation; the hash therefore covers the *entire* canonical payload, never a projection.

---

## 6. Effect adapter interface

```ts
interface AdapterManifest {
  adapter_id: Id; version: string;
  kind: 'DRY_RUN' | 'WEBHOOK' | 'SANDBOXED_SHELL' | 'MCP_TOOL' | 'HUMAN_ONLY';
  operations: Array<{ operation: Id; payload_schema: JsonSchema; reversibility: 'IRREVERSIBLE'|'REVERSIBLE'|'IDEMPOTENT';
                      external_effect: boolean; observation: 'EXACT'|'HUMAN_ATTESTED'|'NONE'; supports_before_state: boolean }>;
  target_profile: { prefix: string; component_regex: string };   // reference: lowercase ASCII [a-z0-9._-] to avoid case-fold/Unicode aliasing
  resource_units: Id[]; claim_ceiling_max: Id[];
  attestation_key_id: string;
  readonly default_enabled: false;                                 // literal type; cannot be true
}

interface EffectAdapter {
  readonly manifest: AdapterManifest;
  dryRun(op: AdmittedOperation, ctx: AdapterCtx): Promise<Receipt<'DRY_RUN'>>;      // never touches the world; always available
  observeBefore(op: AdmittedOperation, ctx): Promise<BeforeState>;                  // digest + identity of the target now
  execute(warrant: Warrant, op: AdmittedOperation, ctx): Promise<ExecutionOutcome>; // only reachable when enabled
  observeAfter(op: AdmittedOperation, warrant: Warrant, ctx): Promise<Receipt<'OBSERVATION'>>;
}
type ExecutionOutcome =
  | { kind: 'REFUSED_BEFORE_EFFECT'; reason }         // definitive; resources may be released (→ REFUSED)
  | { kind: 'OCCURRENCE_UNCERTAIN'; reason }          // → MAY_HAVE_OCCURRED; never retried
  | { kind: 'EXECUTED'; attestation };                // → observeAfter → OBSERVED (not RECONCILED)
```

Rules that hold for every adapter:

- **Disabled by default, three times.** (1) `manifest.default_enabled` is the literal `false`. (2) `adapter_registrations.enabled DEFAULT false` with the `CHECK` that enabling requires `enabled_by/enabled_at`; only an `ADAPTER_ADMIN` may flip it and the flip is journaled. (3) The server loads only adapters named in `FCC_ADAPTERS`; `DRY_RUN` and `HUMAN_ONLY` are always loaded because neither can act on the world unattended. A grant may name only an enabled adapter (trigger); `fcc_consume_admission` re-checks enablement at dispatch time inside the transaction.
- **Confinement.** Adapters run in a child process with no DB credentials and no journal key. They receive `{warrant, operation}` and return outcomes. The adapter recomputes `operation_hash` from the operation it received and refuses if it differs from `warrant.operation_hash`. The adapter attests its receipt with its own key; the server adds the journal HMAC. Two keys, two parties.
- **Before-state.** When `supports_before_state`, `execute` is refused if `observeBefore()` at dispatch ≠ `admission.expected_before_digest`.
- **Per kind:**
  - `DRY_RUN`: validates payload against schema, computes what the operation hash and target lock would be, returns a receipt with `nonclaims: ['occurrence','effect']`.
  - `WEBHOOK`: HTTPS only, host allowlisted in the registration, request body = canonical operation, signed with the adapter key, `Idempotency-Key: <operation_hash>`; the response must echo the operation hash and a receiver digest or the outcome is `OCCURRENCE_UNCERTAIN`.
  - `SANDBOXED_SHELL`: bubblewrap/nsjail (or a Docker container with `--network none`), allowlisted binaries per registration, target directory bind-mounted, CPU/mem/time limits, before/after directory fingerprints as before/after digests. Timeout ⇒ `OCCURRENCE_UNCERTAIN`.
  - `MCP_TOOL`: exactly one MCP server and one tool name pinned in the registration by digest of the tool's schema; arguments are the admitted payload verbatim; the tool's result is the observation. Schema drift at dispatch ⇒ `REFUSED_BEFORE_EFFECT`.
  - `HUMAN_ONLY`: creates a task for a `DISPATCHER`; the human's signed attestation with evidence URIs is the `OBSERVATION` receipt (`observation: 'HUMAN_ATTESTED'`). No attestation ⇒ stays `DISPATCHING` → `MAY_HAVE_OCCURRED` at recovery.

**Breaks if wrong:** If adapters share the server process, a bug in one reaches the journal key. If enablement lived in config only, a config push enables world effects without a journaled actor. If the adapter trusted the server's operation hash instead of recomputing, an edited operation in transit executes. If a timeout mapped to `REFUSED` rather than `OCCURRENCE_UNCERTAIN`, resources release while the effect may have landed (the reference's `UNSAFE_RESOURCE_RELEASE`).

---

## 7. AI drafting assistant

Drafting uses the Anthropic TypeScript SDK (`@anthropic-ai/sdk`), model `claude-opus-5` by default (template-overridable), adaptive thinking, streaming, `strict: true` tools named `draft_configuration`, `draft_figure`, `draft_ground`, `draft_route_field`, `draft_null_route`, `draft_refiguration_plan`, and the server-side `fallbacks: "default"` refusal fallback enabled. Tool input schemas are generated from the same zod schemas as `@fcc/core`, so a draft is structurally a candidate record before it is stored.

How output is stored and kept from becoming standing:

1. Every draft is written to `materials` with `standing = 'MATERIAL'` (the only value the `CHECK` allows), the model id, the canonical request and response digests, and params. The full request/response is journaled (`kind = 'AI_DRAFT'`) so a draft is reproducible and auditable.
2. `materials` has **no disposition column**. Any `disposition`, `closure`, or `completeness` object the model emits inside `body` is stripped on store and replaced with `{disposition:'OPEN', residuals:['residual:unvalidated-draft']}`.
3. Promotion is a human `AUTHOR` action: `FormFigure` / `OpenRouteField` with `source_material_id`. The destination record has `origin = 'AI_DRAFT'`. The core recomputes what is deterministic (closure equality, null-route presence, axis distinctness). Structural checks may legitimately come out `EARNED`; **standing** cannot: qualification receipts on an `AI_DRAFT`-origin record must be human-issued (`must_be_human` defaults true; `role_grants` `CHECK` forbids `AI_AGENT` principals holding `QUALIFIER`/`ADMITTER`/`DISPATCHER`/`RESOLVER`).
4. The AI service account may call the drafting endpoint and nothing else. It cannot create Passages (the P1–P6 role sets exclude `AI_AGENT` at the DB level).
5. Prompt-injection posture: the drafting context is the demand's free text plus template fragments; tool results are never fed back as instructions; the model cannot see or name real record ids other than the case's own configuration; drafts referencing ids outside the case's Configuration members fail promotion.
6. Optional independent-first disclosure (reference §agreement): when the template sets `independent_first: required`, the author must record a digest-bound independent account before the first draft is requested, and the promoted record carries a `use_disclosure` core.

**Breaks if wrong:** If `materials` ever gains a disposition column or `standing` gains a second value, the "material only" property becomes a convention. If tool schemas drift from core zod schemas, drafts stop parsing and authors hand-edit JSON, which loses the reproducibility digest. If the AI principal could hold `AUTHOR` on Passages rather than only on drafting, it could cross P1 itself.

---

## 8. Authority model

| Role | May | May not |
|---|---|---|
| OWNER | manage users, assign roles (journaled, two-person rule for control roles), publish templates | hold QUALIFIER/ADMITTER/DISPATCHER/RESOLVER in the same org |
| AUTHOR | declare configurations, form figures, open route fields, request drafts, promote materials | issue receipts, compile, dispatch |
| QUALIFIER | issue predicate receipts and qualifications | qualify a case whose figure/route field they authored |
| ADMITTER | issue authority grants, compile admissions (P3) | be the grant principal; compile a case they qualified; dispatch |
| DISPATCHER | consume an admission and dispatch (P4); must be the grant principal | compile; resolve their own production |
| RESOLVER | resolve `OPEN`/`MAY_HAVE_OCCURRED` productions with a resolution receipt; issue SUCCESS receipts in Refiguration | dispatch what they resolve |
| AUDITOR | read everything, run `verify-journal`, export anchors | write anything |
| ADAPTER_ADMIN | enable/disable adapters, register attestation keys | any stage action |

Separation of duties is enforced in three places and the DB is the last: (1) server middleware (fast typed 403), (2) core `bindPassage` (`actor ≠ owner` on P3/P4, `min_distinct_actors` across the case), (3) DB triggers on `predicate_receipts`, `control_admissions`, `productions`, `receipts(RESOLUTION|SUCCESS)` that call `fcc_has_role()` and compare principals across the case (`author ≠ qualifier ≠ admitter ≠ dispatcher`). `INTEGRATION` service accounts may hold `DISPATCHER` (a CI bot can dispatch a `DRY_RUN`/`WEBHOOK` operation it has a grant for); `AI_AGENT` accounts may hold only `AUTHOR`-for-drafting.

Grants narrow monotonically, as in the reference: receipt `current_until` ≥ admission `expires_at` ≤ grant `commit_deadline` ≤ `effect_deadline`; warrant `effect_deadline = min(grant.effect_deadline, admission.expires_at)`.

**Breaks if wrong:** If OWNER could hold control roles, one account does the whole loop. If SoD were per-request rather than per-case, the same person could qualify today and admit tomorrow. If a grant's principal could equal its issuer, the admitter self-authorizes dispatch. If role checks lived only in middleware, a direct DB writer (migration script, support tooling) crosses stages with no role.

---

## 9. Abuse and threat surface

| Threat | Defense | Residual risk |
|---|---|---|
| Replayed admission | `fcc_consume_admission` conditional `UPDATE` (rowcount = 1), `productions.admission_id UNIQUE`, immutability trigger, app role has no `UPDATE`, bearer `token_hash` (token shown once to the grant principal) | none within a single-primary Postgres; multi-primary breaks it |
| Operation edited after admission | `operation_hash` bound in the admission; composite FK `(admission_id, operation_hash)` on `productions`; adapter recomputes the hash from the operation it receives; `expected_before_digest` re-observed at dispatch | a *legitimately* changed operation needs a new request, new compile, new admission (by design) |
| Forged receipt | receipts insertable only by the server role; server HMAC (KMS key) + adapter attestation (adapter key); receipt digests referenced by Refiguration branches and journaled; verifier recomputes both MACs | a compromised server host can forge with the server key; adapter attestation still fails, so the forgery is detectable, not prevented |
| Journal tail truncation | DB-computed hash chain; `seq` identity gaps detectable; anchor publisher writes `(seq, hash, signature)` to an external write-once location (S3 Object Lock or a public transparency log) at every admission consumption and every N minutes; `verify-journal --anchor` requires the anchor to be a prefix | truncation between the last anchor and now is undetectable; the anchor cadence bounds the window |
| Journal edit in place | `REVOKE UPDATE/DELETE`, `BEFORE UPDATE OR DELETE` raise, hash chain, HMAC | DB superuser; out of scope, noted in ADR-004 |
| Clock manipulation to extend expiry | expiry checked against both the app `now` and `clock_timestamp()` in the consume function with a skew tolerance; monotonic floor table like the reference's `clock_state` | NTP compromise of both hosts |
| Adapter enablement bypass | DB `CHECK` + journaled `ADAPTER_ADMIN` action + `FCC_ADAPTERS` load list + re-check inside the consume tx | none known |
| Prompt injection into drafts | drafts are material only; dispositions stripped; ids outside the case rejected; AI principal cannot hold Passage roles | a human promoting a bad draft; that is the human's earned standing, which is the point |
| OPEN laundering (rewriting an OPEN record as EARNED) | dispositions immutable per row; new standing needs a new record and Passage; `OPEN ⇒ residuals ≠ {}` | none at the DB layer |
| Null route dropped to reach Control | circular deferrable FK on `route_fields`; compile refuses a NULL selected route | none |
| Cross-org leakage | RLS by `org_id` on every table; `record_index` scoped | app-role RLS bypass if `BYPASSRLS` is ever granted |
| Role self-escalation | role changes journaled; two-person rule for control roles; OWNER excluded from control roles | collusion of two owners |

---

## 10. File structure

```
fcc/
  package.json  pnpm-workspace.yaml  tsconfig.base.json  .eslintrc.cjs (no-io rule for core)
  docs/
    architecture.md        passage.md        threat-model.md        adapters.md
    adr/ 001-ts-core-python-xval.md  002-postgres-single-writer.md  003-invariants-at-db.md  004-journal-anchoring.md
  packages/
    core/src/
      canonical.ts  digest.ts  disposition.ts  ids.ts  time.ts
      schemas/ (zod: configuration, figure, route-field, null-route, passage, receipt, qualification, admission, warrant, production, refiguration, template)
      machine/ case.ts  transitions/{form-figure,open-route-field,qualify,compile-admission,dispatch,observe,reconcile,recover,resolve,refigure,succeed}.ts
      closure.ts  routes/distinctness.ts  passage/bind.ts  compile/bundle.ts
      test/ golden/ (reference example digests)  properties/ (fast-check)  fixtures/
    db/
      migrations/ 0001_identity.sql 0002_templates.sql 0003_stage_records.sql 0004_admissions_inv2.sql 0005_journal.sql 0006_rls.sql 0007_triggers_sod.sql
      src/ repos/  journal/{append,verify,anchor}.ts  tx.ts
      test/ invariants/ (pgTAP or vitest+testcontainers: inv1_passage_required, inv2_replay, inv2_edited_operation, inv3_open_immutable, inv4_null_route)
    server/src/ app.ts  auth/  authority/  routes/  orchestrator.ts  effects/interpreter.ts  adapters/host.ts  xval/client.ts
    adapters/ dry-run/  human-only/  webhook/  sandboxed-shell/  mcp-tool/   (each: manifest.ts, adapter.ts, worker.ts, test/)
    drafting/src/ client.ts  tools.ts (from core schemas)  materials.ts  prompts/
    templates/ schema/demand-template.schema.json  builtin/{file-write,http-webhook-call,human-task}.json
    console/ (case timeline, OPEN ledger, dispatch console, journal verifier)
    cli/ (fcc verify-journal, fcc anchor-head, fcc recover-startup, fcc xval)
  reference/
    figure-control-1.0.1/ (vendored ZIP contents; manifest-verified at CI start via its own verify-package)
    xval/ shim.py  (pure evaluators over stdin/stdout JSON; no store, no adapter, no key)
    harness/ differential.test.ts
```

---

## 11. Implementation order

| Slice | Ships | Why first |
|---|---|---|
| 0 | `core/canonical.ts`, `digest.ts`, `disposition.ts` + golden test reproducing the reference example's `bundle_digest` and every `*_digest` in `compilation_bundle.json` | Everything binds by digest; one byte of canonicalization drift poisons every cross-check |
| 1 | DB migrations 0001–0007 + the five invariant tests, each of which must fail at the DB with no application code present | The invariants are the product; prove them before any logic that could mask them |
| 2 | Core Configuration → Figuration → Route Field: schemas, closure, distinctness, Null Route validation, P1/P2 Passage binding, property tests | Earliest stages, no authority, no effects; establishes the transition shape |
| 3 | Control: qualification, grants, deterministic admission compile, P3, xval sidecar + differential harness in `required` mode | First point where the reference oracle applies end to end |
| 4 | Production with `DRY_RUN` and `HUMAN_ONLY` only: consume, warrant, lifecycle states, receipts, `recover-startup`, `Resolve` | Real INV-2 path with no world-touching adapter |
| 5 | Refiguration, successors, residual ledger, OPEN items, P5/P6 | Closes the loop; OPEN accounting is where products usually cheat |
| 6 | Server API, sessions, role/SoD middleware, minimal console (timeline, OPEN ledger, dispatch) | Usable by humans once the machine is trustworthy |
| 7 | AI drafting → `materials` + promotion path | Needs P1/P2 and the console to exist; adds no standing |
| 8 | `WEBHOOK`, `MCP_TOOL`, `SANDBOXED_SHELL` adapters, each behind enablement | World-touching last, after every gate exists |
| 9 | Anchor publisher, `verify-journal` CLI, AUDITOR views | Detects what earlier slices can't prevent |

**Breaks if wrong:** Building the server or console before slice 1 invites "temporary" application-level enforcement that never moves to the DB. Building adapters before slice 4 tests INV-2 against a world-touching effect.

---

## 12. Verification (once implemented)

- **DB invariant suite** (slice 1): raw SQL tests that (a) insert a route field with no NULL route → fails at `COMMIT`; (b) consume the same admission twice → second raises `ADMISSION_CONSUMPTION`; (c) insert a production with a different `operation_hash` → FK violation; (d) update a disposition `OPEN→EARNED` → trigger raises; (e) insert a figure without `passage_id` → NOT NULL; (f) `UPDATE journal` → raises; (g) app role `UPDATE control_admissions` → permission denied.
- **Core property tests**: no transition emits `EARNED` from an `OPEN` input; every `EARNED` carries a Passage; `transition()` runs inside a `vm` context with no `Date`, `Math.random`, `fetch`.
- **Differential**: every fixture and every staging compilation replayed through `reference/xval`; canonical bytes must match.
- **Golden**: the reference example (`examples/*.json`) round-trips through FCC and reproduces `bundle_digest` `sha256:…` byte-for-byte.
- **Concurrency**: 50 parallel dispatches of one admission → exactly one production row.
- **Recovery**: kill the server between consume-commit and adapter return → production is `MAY_HAVE_OCCURRED`, never retried, resolvable only with a resolution receipt.
- **End to end**: `file-write` template, `DRY_RUN` adapter, four humans with four roles, full loop to a successor Configuration with an `OPEN` residual that stays visible.

---

## Open decisions for you

1. **Repository placement.** `fcc/` inside `trsaso.github.io` (as planned here, on branch `claude/fcc-architecture-design-edd5d8`) or a dedicated repo. This repo is a GitHub Pages site; a monorepo here is workable but odd.
2. **xval mode in production.** `required` (recommended; the reference becomes a hard runtime dependency at compile time only) or `advisory`.
3. **Anchoring target.** S3 Object Lock bucket, a public transparency log, or a second Postgres in another account. Affects slice 9 only.
4. **Default drafting model.** `claude-opus-5` as designed, or `claude-sonnet-5` for cost.
5. **Two-person rule for role changes.** Designed as on; say if a single OWNER should be able to assign control roles in small orgs.
