# SHIRO Studio and Deployment-Ready Workspace

## Intent

Give SHIRO a Studio workspace that turns an indexed GitHub codebase into clear, source-grounded explanations and reusable learning artifacts. The user asked for fuller visual and written explanations, reports, and NotebookLM-style outputs, then chose reports, mind maps, flashcards, and quizzes as the first target. They also requested a deployment-ready Vercel app, a working tutorial, and project graph/mind-map visuals, explicitly without a marketing landing page.

## Why

SHIRO currently answers one question at a time, offers a parser-derived import graph, and stores investigation notes. A developer learning an unfamiliar repository also needs a guided walkthrough, a visual map they can navigate, and ways to check their understanding. These outputs should help them move from a question to the real files and symbols behind it.

## Goals

- Keep `/` as the working SHIRO application; do not add a marketing landing page.
- Add a first-class **Studio** view to the existing SHIRO workspace.
- Add an in-app, skippable, restartable first-run tour that teaches connect → browse → graph/mind map → ask with citations → create a Studio artifact. It must point to real controls and never fake completion.
- Make visual code understanding prominent: distinguish the existing parser-derived import graph from a new folder/symbol mind map, and provide a file/detail inspector linked to Sources.
- Generate structured, longer-form repository explanations and reports with source citations.
- Provide report formats suited to codebases: repository briefing, architecture walkthrough, feature/data-flow trace, and bug investigation.
- Provide an interactive codebase mind map from indexed paths, symbols, and resolved imports. Selecting a node opens its source file.
- Generate flashcards and quizzes from the selected repository's indexed source, with answer explanations and source citations.
- Save generated reports and study sets under the repository and indexed commit, and allow users to revisit or remove them.
- Export reports as Markdown without adding a document-generation dependency.
- Preserve the existing chat, file browser, import map, investigations, public GitHub connection, local development mode, and source citation behavior.
- Prepare a hosted Vercel mode with Supabase Auth and persistent Postgres. Every hosted repository, indexed file, symbol, edge, investigation, and Studio artifact is scoped to the signed-in user. Anonymous users can only see the sign-in UI and health endpoint.
- Provide GitHub OAuth sign-in through Supabase Auth. This is separate from public GitHub source import and does not grant private repository access.

## Non-goals for this release

- Audio Overview, podcast voices, or Video Overview. SHIRO has no speech or video generation service.
- Web research, public sharing, Google Drive/Docs imports, slide decks, image generation, or NotebookLM account parity.
- Private source repository access (GitHub sign-in is for application identity only).
- Running repository code or sending the full repository to an AI provider.
- Claiming the current import parser produces a complete architecture or call graph.

## Product and technical constraints

- Keep the Python standard-library local server and vanilla HTML/CSS/JavaScript frontend; retain SQLite only for local single-user development.
- Hosted Vercel mode uses Supabase Postgres and Supabase Auth. Never use function-local SQLite as hosted persistence.
- Keep the fixed NVIDIA hosted free endpoint when available; never offer paid model selection. The provider may be unavailable or rate-limited, so generated outputs need an honest error/fallback state.
- Send only selected evidence excerpts to NVIDIA, never the entire repository. Use repository text as untrusted data and require the model to return structured output that the server validates.
- Every generated factual claim, card, quiz answer, and explanation must cite indexed file paths and line ranges. If evidence is insufficient, say so rather than inventing details.
- The mind map is derived from stored repository structure and import edges and remains useful without NVIDIA. Clearly label the graph as parser-derived and incomplete where appropriate.
- Artifacts belong to a repository snapshot (`repo_id` plus `commit_sha`); a later re-indexed commit must not silently relabel old outputs as current.
- Delete the repository's saved artifacts when its local index is deleted.

## Deployment requirements

- Vercel runs a request-scoped Python API function; the workspace and Shiro artwork are static files.
- Hosted mode includes reviewed SQL migrations with ownership columns, foreign keys, required indexes, and RLS policies.
- Hosted API requests validate Supabase Auth access tokens server-side and authorize each repository operation against that user id. RLS is defense in depth, not a replacement for API ownership checks.
- GitHub sign-in uses Supabase Auth OAuth. Include setup steps for GitHub OAuth callback, Supabase redirect allowlist and migration, and Vercel environment variables.
- Missing hosted configuration fails closed with actionable guidance and never falls back to SQLite. Local mode is explicit and local-only.
- Include Vercel API/static routing, pinned runtime dependencies, deployment environment example, and health diagnostics that omit secrets.
- Report deployment readiness separately from a live deployment. Live deployment requires provider credentials, migration application, a successful Vercel build, and auth/data-isolation verification.

## Implementation decisions

- **Browser auth:** use the pinned `@supabase/supabase-js` browser client with PKCE, session refresh and sign-out. Load only the URL and publishable key from a same-origin `/api/config` endpoint. Attach the current access token as `Authorization: Bearer` on every protected SHIRO API request.
- **Vercel adapter:** keep the existing `BaseHTTPRequestHandler` route logic and expose it through `api/index.py` as the Vercel Python handler; rewrite `/api/:path*` to that function while serving `/`, scripts, styles, and images from the static `web/` output directory.
- **Hosted database:** use pinned Psycopg 3 with the Supabase transaction pooler `DATABASE_URL`; keep SQLite only for local mode. A compatibility adapter preserves current SQL/query code paths, translates the few SQLite-specific inserts, returns dict-like indexed rows, and scopes each hosted transaction with Supabase's `authenticated` role and request JWT subject so database RLS is active.
- **Identity and ownership:** validate every bearer token with Supabase Auth `/auth/v1/user`; add an `owner_id` foreign key on repositories and authorize repository reads/writes by id plus owner id. Child tables use RLS policies through their parent repository. Use no service-role key.
- **Tour completion:** each step advances only on its named real action (connect/select repo, browse/open file, open graph or map, submit an Ask question and open a citation, create a Studio artifact). Skip is always available; completion is stored only after all steps are visited, per signed-in user in hosted mode and in local storage in local mode.
- **Mind map rendering:** use the existing SVG/DOM stack with keyboard-focusable nodes and relationship lines, no chart framework. Keep folder hierarchy tree as parent-child edges and import edges as separate cross-links, preserving cycles without duplicates.

## Builder calls

- **Snapshot timing:** generation always reads the repository's currently indexed immutable snapshot and stores its current commit SHA. The current app has no in-place re-index endpoint; deleting/reconnecting creates a new repository id and leaves its prior outputs attached to the prior index only if that index is retained. In this release, repository deletion cascades to its artifacts as stated above.
- **Evidence bounds:** reuse the current lexical retrieval bound of at most 8 source files and the current maximum of 3 short excerpts per file. A format-specific retrieval query combines the user's focus and the requested output type. If those excerpts do not cover a requested conclusion, return an explicit evidence gap instead of expanding to the full repository.
- **Mind-map graph:** file paths form one folder tree; symbol nodes, when present, appear as children of their file. Resolved import relationships are separate cross-links between file nodes, so cycles and cross-folder imports do not duplicate nodes or break the hierarchy. Folder nodes do not receive invented import links.
- **Repeated generation:** every successful explicit Generate action creates a new artifact with a unique id; failed generation creates none. The submit button stays disabled during an active request to reduce accidental duplicates.

## Experience

Add **Studio** to the feature rail and repository tool tabs. Its empty state asks the user to select an indexed repository and offers four clear output actions: **Report**, **Mind map**, **Flashcards**, and **Quiz**.

The report builder asks for a format and a short focus. Formats are:

1. **Repository briefing** — purpose, major areas, entry points, key flows, and caveats.
2. **Architecture walkthrough** — modules and their supported relationships, with important files.
3. **Feature trace** — where a named behavior starts, what files/symbols it passes through, and where it ends, when the source supports that trace.
4. **Bug investigation** — observed issue, likely relevant code paths, evidence, and concrete next inspection steps. It must not state a root cause as fact unless the cited code proves it.

Generated reports render as readable Markdown-like content with a summary, sections, citations, and an evidence/caveats footer. Citation links switch to Files and open the cited line range. A Markdown download button exports the displayed report.

The mind map uses a navigable tree/canvas rooted at the repository, grouped by top-level folders and connected by resolved import relationships. Labels include indexed symbols where available. Pan/zoom or an equivalent keyboard-friendly tree navigation is supported; clicking a file/symbol opens the relevant source. The current parser-derived import map remains a separate tool.

Flashcards show one prompt at a time, reveal the answer on demand, and allow previous/next navigation. Quizzes show multiple choice, explain the correct answer after submission, and let the user continue through the set. Both show source citations for their answers. The first release uses one generated set per request; difficulty/count options can be fixed to small, bounded defaults rather than adding a settings matrix.

Generated artifacts are listed in Studio with their type, title/focus, creation time, and source commit. Opening an artifact displays its content; deleting an artifact is explicit. Existing investigations stay in their current view and table.

## Data and API contract

- Add a local `artifacts` table keyed by artifact id, with repository id, source commit, type, title/focus, validated JSON payload, and creation time. Use a foreign key with cascade deletion from the repository.
- Add `GET /api/repositories/{id}/artifacts` to list saved artifacts and `DELETE /api/repositories/{id}/artifacts/{artifact_id}` to remove one.
- Add `POST /api/repositories/{id}/artifacts` for reports, flashcards, and quizzes. Request fields are an allowlisted `type`, a bounded `focus`, and bounded options. Responses return the saved artifact and provider/caveat metadata.
- Add a source-derived mind map endpoint or extend the existing graph response with a bounded hierarchical view model. The response includes repository commit, nodes with stable file/symbol identifiers, and resolved edges only.
- Validate all model JSON and citation paths/ranges against indexed file rows before persistence. Reject malformed or unsupported citations; never render model-provided HTML.
- Preserve current `/ask`, `/files`, `/file`, `/graph`, and `/investigations` contracts.

## Success criteria

- A developer can generate and reopen each of the four selected Studio outputs for an indexed public repository.
- The mind map works when the model provider is offline and every file node can navigate to source.
- Reports, flashcards, and quizzes either return validated source citations or show a clear generation failure; unsupported claims are not presented as evidence-backed.
- Saved artifacts retain the source commit they came from and are deleted with their repository.
- Existing repository, chat, file, graph, and investigation workflows continue to work.
- The Studio remains keyboard accessible and responsive within the established SHIRO workspace.
- A signed-out visitor sees a branded sign-in state inside the app workspace; an authenticated user can complete the tour, connect a public repo, view both visualizations, generate a cited artifact, and export a report.
- Hosted repository data and artifacts persist in Supabase Postgres and remain inaccessible across user accounts through API checks and RLS.
- Vercel deployment configuration and human-readable Supabase/GitHub OAuth setup instructions are committed; secrets and the local database remain ignored.
- Deployment readiness and an actual deployment are reported separately.

## NotebookLM reference and differentiation

The requested inspiration is NotebookLM's Studio concept and source-grounded reports, mind maps, flashcards, and quizzes. Google also describes newer slide decks, infographic, and export formats; those are not part of this first implementation because this app currently has no slide/image-generation pipeline. SHIRO differentiates by centering indexed code, file/symbol navigation, commit provenance, and citations to exact source ranges.

References:

- Google, [6 ways to use NotebookLM to master any subject](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-student-features/)
- Google, [Do your best research with NotebookLM](https://blog.google/innovation-and-ai/products/notebooklm/better-research-notebooklm/)
- Google, [NotebookLM Help](https://support.google.com/notebooklm/answer/16246230?hl=en)
