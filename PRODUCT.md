# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers who need to understand an unfamiliar public GitHub repository and locate the code relevant to a question, bug, or investigation.

## Product Purpose

SHIRO CodeMind indexes a bounded source snapshot and helps developers browse files, inspect parser-derived imports, search code, and ask source-grounded questions. Success means reaching the relevant code quickly and being able to verify every repository-specific answer against the indexed source.

## Positioning

SHIRO ties repository exploration and answers to real indexed files, line excerpts, and snapshot provenance rather than presenting unsupported architectural claims as fact.

## Operating Context

The application runs locally with SQLite or as a Vercel-hosted workspace using Supabase Auth and persistent Postgres. It indexes public GitHub repositories; hosted users own their repository snapshots and outputs. Repository-specific explanations should remain tied to matched source evidence.

## Capabilities and Constraints

- Connect and index a bounded public GitHub source snapshot.
- Browse indexed files, search source, inspect resolved relative imports, and save investigations.
- Visualize the file/folder/symbol hierarchy and resolved imports; learn the workspace with an action-gated guided tour.
- Generate and revisit source-cited reports, flashcards, and quizzes, preserving the snapshot commit.
- Optional NVIDIA hosted answer generation uses a fixed free endpoint; a missing or unavailable provider falls back to local retrieval.
- Repository source code is never executed. Full repository data remains local; only matched excerpts and the question are sent to NVIDIA when the provider is configured.
- Local development stays on loopback and SQLite. Hosted deployment requires Supabase Auth, Postgres, RLS, and per-user repository checks; missing hosted config must not fall back to SQLite.
- Preserve the Python HTTP server, vanilla HTML/CSS/JavaScript frontend, local SQLite mode, and existing API behavior.

## Brand Commitments

- Product name: SHIRO CodeMind; short name: SHIRO.
- SHIRO is a prominent, character-led assistant in the product interface, with analytical, concise, evidence-first communication.
- Use the Shiro character artwork and expression assets already extracted from the user's supplied asset sheet in `web/assets/`; preserve their provenance in the asset README.
- The user chose a single, full SHIRO workspace with the character prominent, chat centered, and repository tools in surrounding navigation.

## Evidence on Hand

- Existing source-indexing, repository, file, graph, investigation, and question API implementations in `server.py`.
- Existing browser UI logic in `web/app.js` and the provided character assets in `web/assets/`.
- No verified production telemetry, customer proof, or performance benchmarks; do not fabricate any.

## Product Principles

1. Keep developers in the code and make source evidence easy to inspect.
2. Let SHIRO's visible state follow real application events.
3. Preserve local-first handling and be explicit when excerpts leave the machine.
4. Keep the character expressive without obstructing repository work.
5. Prefer verified detail over confident but unsupported answers.

## Accessibility & Inclusion

Keep the workspace keyboard-operable, responsive, readable at common zoom levels, and respectful of reduced-motion preferences.
