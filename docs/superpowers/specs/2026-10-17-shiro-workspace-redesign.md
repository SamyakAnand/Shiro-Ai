# SHIRO Workspace Redesign

## Intent

Replace the current marketing-page-plus-dashboard experience with the SHIRO CodeMind application as the home screen. Shiro should be the clear visual identity and active assistant; the repository tools stay immediately available around the conversation.

## Why

The existing page gives most of its space to marketing copy and hides Shiro in a small floating widget. That makes the product feel like a generic repository dashboard with a character attached. The chosen direction is a full workspace where the character, evidence-backed conversation, and code navigation belong to one product surface.

## Goals

- Put the full repository workspace at `/` with no separate marketing hero or long landing-page sections.
- Make the existing Shiro portrait and expression art visually prominent and reuse existing local assets.
- Center the conversation as the primary task; show Shiro's current state beside it.
- Keep repository selection, file browsing, graph exploration, investigations, source citations, and repository connection usable from the same workspace.
- Preserve local-first behavior, explicit source evidence, and truthful loading/error/empty states.
- Adapt the layout to desktop, tablet, and phone widths; honor keyboard focus and reduced-motion preferences.

## Non-goals

- Rewriting the Python API, indexing implementation, or SQLite schema.
- Adding fake metrics, seeded repository data, fabricated activity, or simulated AI actions.
- Adding new libraries, a 3D character, generated character art, authentication, or streaming that the server does not support.
- Turning the product into a fan page or a static chatbot mockup.

## Surface and visual direction

- Mode: Operate. The user's primary job is asking a question about a selected repository and checking its real source evidence.
- The user approved one full SHIRO workspace: prominent Shiro, chat centered, repository/files/graph/investigations in the surrounding navigation.
- Visual world: Shiro's Code Observatory. Dark graphite and midnight surfaces, icy white type, restrained cyan and violet light, precise borders, and the provided character art. The work surface remains a recognizable developer application, not a fictional control panel.
- Desktop composition: narrow feature rail, repository sidebar, central conversation workspace, and a character/status stage on the right. The conversation owns the largest column.
- Responsive composition: reduce the right character stage to a compact profile at tablet widths; on phones keep conversation primary, expose tools in a compact navigation row, and make repository selection reachable without horizontal overflow.
- Signature interaction: the existing local expression images change only when real request/application state changes; evidence cards link into the file viewer.

## Product behavior to preserve

- Existing data-tab views for Ask SHIRO, files, imports/graph, and investigations.
- Existing `/api/repositories`, `/files`, `/file`, `/graph`, `/investigations`, and `/ask` integration.
- Conversations remain local to the selected repository in browser storage; repository answers still show actual indexed evidence and provenance.
- SHIRO starts in a useful empty state when no repository is indexed and offers the real connect flow.

## Risks and guardrails

- Moving the assistant into the main workspace can break selectors or event handlers. Keep stable IDs where practical and cover the new shell with a regression test.
- The asset sheet contains crops, not rigged animation. Use simple image swaps/transitions and never claim the character is 3D or fully animated.
- At narrow widths, workspace tools must remain reachable; hide decoration before hiding functionality.
