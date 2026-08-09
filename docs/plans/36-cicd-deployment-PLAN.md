# 36 — CI/CD & Deployment Runbook · PLAN

**Status: not started — deferred to Phase 9 per AD-23 and ROADMAP.**
**Renumbered 2026-07-30:** was plan 21; the old number is retired.

Goal: no human runs the verification ladder from memory before a merge, and
no deploy is a mystery. Ships: a GitHub Actions CI pipeline enforcing the §5
ladder on every PR, branch protection making it binding, deploy wiring per
HOSTING.md (Coolify staging/prod, Vercel demo) with notifications and a
practiced rollback, and the deployment half of `docs/RUNBOOK.md`.

**Sequencing note:** This plan is deferred to Phase 9 per AD-23 and the
ROADMAP strategy ("business logic first"). A minimal CI gate (tsc + eslint +
unit test on PRs to `dev`) is permitted early as a development convenience.
Full CI/CD with automated deploys, blue-green strategies, and rollback
automation waits until Phases 1–6 are functionally complete.

Preconditions: executes after plan 37 — the check job includes plan 37's
coverage gate (`npm run test:coverage`). Branch `chore/36-cicd-deployment`.

## Reasoning

AGENTS.md §10.8 already legislates the flow (feature → `dev` → `master`,
"Every PR to dev must pass tsc, eslint, and the test suite") — but there are
no workflows in `.github/`, so the legislation is currently enforced by
discipline alone. CI is that rule made mechanical. The design constraint
that matters: the test suite was deliberately built Docker-free (PGlite
in-process, §7b.1), so CI needs no service containers and stays fast and
cheap — the repo's testing architecture was shaped for exactly this moment.

Deployment is intentionally boring: Coolify and Vercel both auto-deploy on
push (HOSTING.md), so "CD" here is not pipeline-built — it's verifying the
wiring, adding deploy notifications, and rehearsing rollback. The checklist
rows this plan owns: CI runs on every push, builds fail on test failure,
secrets not in build output, one-command deploy, rollback capability,
deployment documented.

## Design choices

- **One workflow, `ci.yml`,** on PRs to `dev` and `master` and pushes to
  both. Jobs:
  1. **check** — `npm ci`, `npx tsc --noEmit`, `npx eslint src`,
     `npm run test` (unit), `npm run test:integration` (PGlite — no
     services), `npm run test:coverage` (plan 37's gate — scoped
     70/60/65, per-file money floors), `npm audit --audit-level=high`.
  2. **build** — `next build` **twice**, once per mode
     (`NEXT_PUBLIC_APP_MODE=demo` and `live` with dummy-but-valid env) —
     the mode split means one green build proves half the product; the
     appendix says both must be exercised.
  3. **gitleaks** — secret scan on the diff (full-history scan was plan
     17's one-time job).
  E2E (Playwright) is **not** in the PR gate yet: per §7b.8 it runs on
  migration PRs — wire it as a manually-triggerable + nightly-on-`dev`
  job, promoted into the gate when the suite is stable enough not to flake
  the release flow.
- **Branch protection** on `dev` and `master`: required status checks
  (check, build, gitleaks), no direct pushes, no force-push — turning
  §10.8's "rules" into settings. `master` additionally requires the PR to
  originate from `dev` (release PRs only), enforced by convention + a
  workflow guard that fails on any other head branch.
- **Secrets:** CI needs none beyond dummy env for the live build (dummy
  `AUTH_SECRET` etc. defined inline, clearly fake). Real secrets live only
  in Coolify/Vercel env config — GitHub Actions never touches deploy
  credentials because it never deploys; the platforms pull on push. This
  keeps the checklist's "secrets not in build output" trivially true for
  CI artifacts.
- **Deploy notifications:** Coolify webhook → email (plan 25's infra when
  it lands; a plain SMTP/Discord webhook until then) announcing
  deploy start/success/failure with the git SHA. Sentry (plan 32) release
  tagging ties errors to deploys.
- **Rollback = redeploy previous image** in Coolify (both stage and prod
  keep N previous builds). The wrinkle worth documenting honestly:
  migrations. `prisma migrate deploy` runs forward-only; the runbook's
  rollback procedure states the rule — **code rolls back freely only
  across non-breaking migrations**, so migrations must stay
  backward-compatible with the previous release (expand-contract: add
  columns nullable, backfill, tighten later; never drop/rename in the same
  release that stops using a thing). This becomes a review-checklist rule
  for every migration PR from now on.
- **RUNBOOK.md (deployment half):** deploy-a-release step-by-step (open
  `dev`→`master` PR, what the description must contain per §10.8, what to
  watch after merge), rollback walkthrough (executed once on staging as
  part of this plan, output pasted), hotfix flow, environment/env-var map,
  on-call contacts table (the checklist's emergency-contacts block, filled).

## Implementation strategy

1. `ci.yml` (check — incl. plan 37's coverage gate — build×2, gitleaks);
   prove it red-then-green with a deliberate failing commit on the PR
   itself.
2. Branch protection on `dev`/`master` + the release-PR head guard.
3. Nightly + manual E2E workflow (Playwright), not in the gate.
4. Coolify deploy notifications; verify staging auto-deploy end-to-end
   with a trivial change.
5. Rollback rehearsal on staging: deploy, roll back one release, verify
   the app serves the prior build; document as performed.
6. RUNBOOK.md deployment sections; AGENTS.md §10.8 gains one line noting
   CI now enforces the PR rules (§9.9 same-PR rule).

## Testing

This plan's product *is* verification infrastructure, so testing is
behavioral and self-referential:

- The plan's own PR passes the new gate; a deliberate broken commit on it
  is shown failing (screenshot/log in PR).
- Both build-mode jobs fail correctly when fed the wrong mode value
  (misconfig check — the appendix says invalid modes must fail).
- Direct push to `dev` rejected; PR to `master` from a non-`dev` branch
  fails the guard.
- Staging deploy notification received; rollback rehearsal evidence in
  the PR.
- CI wall-clock stays under ~5 minutes — a slow gate gets bypassed
  culturally; if over, cache `node_modules`/Next build cache before
  merging.

## Review checklist

- CI has zero real secrets; dummy env clearly labeled fake.
- The PGlite suite runs with no service containers (checklist: tests are
  infra-free — protect that property).
- Both app modes built on every PR; neither marked optional.
- Migration backward-compat rule added to the review culture (this plan's
  docs + a line in §6's hunt list if warranted).
- Rollback documented from having done it, not from Coolify's docs.
- Contacts table filled with real names, not placeholders.

## Exit criteria

A PR cannot reach `dev` or `master` without tsc, eslint, unit+integration
tests, both-mode builds, audit, and secret scan passing; pushes deploy
automatically with notifications; a rollback has been rehearsed on staging
and documented; and RUNBOOK.md gets a new engineer from "approved PR" to
"verified in production" without asking anyone — the checklist's CI/CD and
deployment-documentation rows fully checked.
