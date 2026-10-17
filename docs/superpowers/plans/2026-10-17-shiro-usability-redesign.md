# SHIRO Usability Redesign Implementation Plan

> **For agentic workers:** Implement this plan inline with test-driven development. Preserve the existing SHIRO product identity and all working repository features.

**Goal:** Make SHIRO understandable to a first-time developer by replacing duplicate navigation with one obvious workspace menu and guiding the empty state into the first useful action.

**Architecture:** Keep the vanilla HTML/CSS/JavaScript app shell and existing routes. On desktop, put full-text feature navigation in the repository sidebar and remove the duplicate in-workspace tab strip. Keep a compact, labeled bottom navigation on mobile. Preserve the assistant stage and repository selector. Make the no-repository state an actionable workspace empty state with a clear connect action and a short explanation of what follows. Rename destinations and add one-sentence purpose text to each feature view.

**Files:** `web/index.html` owns navigation, empty-state markup, and view content; `web/app.js` owns active navigation, first-run state, labels, and interaction behavior; `web/styles.css` owns responsive shell and accessible state styling; `tests/test_ui_shell.py` covers single navigation, helpful empty state, and feature explanations; `PRODUCT.md` records the resulting information architecture.

## Tasks

1. Add failing UI-shell tests for exactly one desktop feature navigation, no duplicate inner tab bar, plain-language destination labels, and the repository-first empty state. Run and confirm the expected failures.
2. Rebuild the desktop sidebar as the single full-text workspace navigation plus repository list. Keep responsive bottom navigation on mobile. Update `setTab`, selected state, accessibility attributes, and title/context behavior without changing API calls.
3. Replace the unusable no-repository chat-first state with an in-workspace connect-repository stepper and hide actions that require an indexed repository. Keep the guided tour manual and non-blocking.
4. Clarify each feature view with plain-language heading, purpose, entry instructions, and useful empty/loading/error states. Preserve all existing feature interactions, source citations, graph modes, investigations, and Studio outputs.
5. Run the full test/build checks and inspect first-run and repository-selected states at desktop and mobile sizes. Refine overflow, focus, selected states, and labels based on the live preview.
