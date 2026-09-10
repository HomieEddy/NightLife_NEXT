# Branch protection — one-time GitHub setup (plan 36)

These are **GitHub repository settings**, not committed config, so they must be
applied once by a repo admin (Settings → Branches). Until they are set, CI runs
but nothing forces a PR to pass it. This file is the source of truth for what
to click.

Cross-ref: `AGENTS.md` §10.8 (branching rules), `.github/workflows/ci.yml`
(the checks), `.github/workflows/release-guard.yml` (the `master` head guard).

## `dev` (staging)

Branch name pattern: `dev`

- [x] **Require a pull request before merging**
  - Required approvals: 0 (solo project; the gate is CI, not review)
- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Required checks:
    - `check (types, lint, tests, coverage)`
    - `build (demo mode)`
    - `build (live mode)`
    - `secret scan`
- [x] **Do not allow bypassing the above settings**
- [x] **Block force pushes**
- [x] **Restrict deletions**

## `master` (production + demo)

Same as `dev`, plus:

- [x] **Require a pull request before merging** (release PRs only)
- Required checks: the same four as `dev` **plus**:
  - `head branch is dev or hotfix/*` (from `release-guard.yml`)
- [x] **Block force pushes** · [x] **Restrict deletions**

The head-guard check mechanically enforces §10.8's "`master` accepts merges
from `dev` only" (with the `hotfix/*` exception). A PR from any other branch
fails the check and cannot merge.

## After protection is on

1. Open a throwaway PR to `dev` from a scratch branch; confirm the four checks
   appear as **required** and the merge button is blocked until they pass.
2. Push directly to `dev` from the command line; confirm GitHub rejects it.
3. Open a PR from a non-`dev` branch to `master`; confirm
   `head branch is dev or hotfix/*` fails.

Record the date these were applied (and by whom) below, so the paper trail
matches the setting:

| Date | Applied by | Notes |
|------|-----------|-------|
| _(pending)_ | | |
