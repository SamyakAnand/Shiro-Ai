# SHIRO Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SHIRO CodeMind web app itself a character-led repository workspace, with its conversation central and real code tools adjacent.

**Architecture:** Keep the Python API and local data model. Replace the marketing-page shell with a responsive app shell, move the existing repository-scoped companion conversation into the primary Ask view, and retain the existing file, graph, investigation, repository, and evidence API flows.

**Tech Stack:** Python standard library server, SQLite, vanilla HTML/CSS/JavaScript, local PNG assets.

**Spec:** `docs/superpowers/specs/2026-10-17-shiro-workspace-redesign.md`

## Global Constraints

- Do not add third-party dependencies or rewrite the backend.
- Never execute indexed repository source.
- Only show repository answers grounded in matched indexed excerpts; preserve source links and snapshot provenance.
- Character states must follow actual application events and respect reduced-motion preferences.
- Do not fabricate repository content, usage metrics, or model activity.
- Keep all workspace actions usable at desktop, tablet, and phone widths.

## Review Focus

- Empty repository state: Shiro and a real connect action remain visible without fabricated data.
- Existing repositories: selecting a repo still refreshes files, investigations, question context, branch, and commit.
- Evidence links: opening a citation still selects and displays its source file.
- Provider errors/timeouts: the conversation shows the real fallback or error state and does not claim success without evidence.
- Phone width: navigation, repo selection, composer, and evidence remain reachable without horizontal overflow.

---

### Task 1: Replace the landing shell with the SHIRO workspace

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Test: `tests/test_ui_shell.py`

**Interfaces:**
- Preserve IDs and classes used by current repository selectors and dialogs.
- Provide workspace views `#view-ask`, `#view-files`, `#view-graph`, and `#view-investigations` with `data-tab` navigation.

- [x] **Step 1: Write the shell regression tests**
- [x] **Step 2: Run tests and observe the expected failure** — `py -m unittest discover -s tests -p test_ui_shell.py -v` fails because the full workspace and integrated conversation do not exist yet.
- [ ] **Step 3: Build the workspace shell** — Replace marketing sections with the rail, repository sidebar, central work area, and Shiro stage. Keep the existing connect dialog.
- [ ] **Step 4: Run shell regression tests** — All shell tests pass.

### Task 2: Move SHIRO's conversation into the main workspace

**Files:**
- Modify: `web/index.html`
- Modify: `web/app.js`
- Modify: `web/companion.css`
- Test: `tests/test_ui_shell.py`

**Interfaces:**
- `#companion-form` submits questions to the existing `/api/repositories/{id}/ask` endpoint.
- `#companion-messages` stores and renders the current repository's conversation.
- `#shiro-portrait`, `#companion-launcher-portrait`, `.companion-state-label`, and `#companion-activity-text` represent the actual character state.

- [ ] **Step 1: Keep the conversation in the main Ask view** — Remove the floating launcher and place the existing expression, messages, composer, activity, and evidence links in the primary workspace.
- [ ] **Step 2: Update event wiring** — Remove assumptions about the floating launcher and duplicate Ask form; preserve repository connection, suggestion buttons, tab navigation, file links, health, and state changes.
- [ ] **Step 3: Verify behavior tests** — `py -m unittest discover -s tests -v` passes, including shell, provider, source retrieval, and repository-safety tests.
- [ ] **Step 4: Verify JavaScript syntax** — `node --check web/app.js` exits successfully.

### Task 3: Apply the new visual system and responsive behavior

**Files:**
- Modify: `web/styles.css`
- Modify: `web/companion.css`
- Modify: `web/index.html`
- Create: `DESIGN.md`
- Create: `.impeccable/design.json`
- Modify: `README.md`

**Interfaces:**
- The styling uses the local Shiro PNG assets and existing DOM state attributes; it adds no image-generation dependency or third-party UI library.
- README explains the new app-first home screen and where repository features live.

- [ ] **Step 1: Establish tokens and component states** — Use graphite/midnight surfaces, icy text, cyan/violet accents, readable borders, stable focus styles, and explicit states for empty, waiting, success, warning, and error.
- [ ] **Step 2: Add responsive layouts and reduced-motion behavior** — Keep the chat usable at 1440px, 1024px, and 390px, and provide a static motion fallback.
- [ ] **Step 3: Run automated checks** — `py -m unittest discover -s tests -v`, `py -m py_compile server.py`, `node --check web/app.js`, and the Impeccable detector.
- [ ] **Step 4: Inspect desktop and mobile app renders** — Capture and inspect desktop plus phone screenshots once, batch any material fixes, then confirm once.
