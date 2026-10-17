# SHIRO Studio and Deployment Plan

> Execute this plan in order. Keep `/` as the app workspace and preserve existing source-grounded flows.

**Goal:** Add interactive source-based reports, mind maps, flashcards, quizzes, and a real guided walkthrough; prepare secure Vercel hosting with Supabase Auth and persistent Postgres.

**Architecture:** Continue the Python HTTP API + vanilla frontend locally. Add Studio artifact APIs and a tree/mind-map representation derived from indexed source. For deployment, route Vercel API requests through a Python handler, authenticate each hosted request with Supabase Auth, store hosted indexes in Postgres with owner scoping, and fail closed if hosted configuration is incomplete. No local SQLite fallback in Vercel.

**Spec:** `docs/superpowers/specs/2026-10-17-shiro-studio-outputs-design.md`

## Global constraints

- No marketing landing page; `/` is the signed-in SHIRO workspace.
- Preserve source citations, immutable commit provenance, public GitHub import, and existing local SQLite mode.
- Never run indexed repository code or render provider/model HTML.
- Hosted identity is Supabase Auth; no service-role key in browser or server. Require explicit repository ownership checks and RLS.
- Keep new dependencies pinned. Do not include credentials in source or git.

## Tasks

### 1. Persist and generate Studio artifacts
- Add local artifact schema with cascade deletion and APIs to list, generate, open, delete.
- Add bounded report/flashcard/quiz generation from retrieved excerpts; validate all citations against indexed source before saving.
- Add report export and commit attribution.
- Verify with unit tests covering limits, invalid citations, persistence, and cascade behavior.

### 2. Add visual mind map and guided tour
- Add Studio view, mode switching, artifact list and rendering, citation navigation, accessible keyboard controls.
- Add a folder/symbol hierarchy and resolved import cross-links; keep import graph as a separate view.
- Add skippable/restartable tour whose progress is recorded only by completing real UI actions.
- Verify APIs, UI shell, mobile/responsive behavior, keyboard and reduced-motion states.

### 3. Prepare secure Vercel + Supabase hosting
- Add pinned browser and Python dependencies, a Vercel Python entrypoint, static output/routing config, environment example, and SQL migration.
- Keep local SQLite; in Vercel require Supabase URL, publishable key, and Postgres URL, authenticate bearer tokens, scope all queries by owner, enable/force RLS and indexes, and return actionable errors when config is missing.
- Add GitHub OAuth sign-in flow and setup guide without conflating identity with private source access.
- Verify local tests, API security behavior, build, and deployment config. Report any step requiring user-owned external credentials separately.

### 4. Final verification and handoff
- Run all pre-existing and new checks, inspect UI at desktop and mobile once, and run the Impeccable detector once after UI edits.
- Review the diff for security, unintended generated files, and secret leakage.
- Commit and push only after verification; do not claim a live Vercel deploy without credentials and a successful hosted verification.
