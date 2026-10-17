# SHIRO CodeMind

**Every Codebase Has a Pattern. SHIRO Finds It.**

SHIRO is a local-first codebase intelligence workspace. The home screen is the SHIRO assistant: connect a public GitHub repository, ask about its source, inspect citations, browse files, explore imports, and save investigations from one place. The application is read-only and does not execute repository code.

## Current architecture

```text
Browser (HTML/CSS/JavaScript)
         │ same-origin JSON API
Python standard-library HTTP server
         ├── GitHub public repository API (metadata + ZIP archive)
         ├── Python AST / bounded JavaScript and TypeScript parsing
         └── SQLite local index (files, symbols, imports, investigations)
```

There is no frontend build step, no third-party Python dependency, no embeddings, and no account system. Optional grounded answer generation uses NVIDIA's hosted API only when `NVIDIA_API_KEY` is configured. It runs on a single developer machine. Do not expose the local server to a network: the MVP has no authentication or multi-user authorization.

## Requirements

- Python 3.10 or newer
- Network access to public GitHub repositories for repository connection
- A modern browser

## Run locally

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
py server.py
```

Open <http://127.0.0.1:8001>. The built-in server uses Python's standard library; `requirements.txt` is intentionally empty. The UI loads the Switzer font from Fontshare when network access is available, with local system font fallbacks.

Optional configuration: set `SHIRO_HOST`, `SHIRO_PORT`, or `SHIRO_DB` in the process environment. Put `NVIDIA_API_KEY` in the ignored, local `.env` file to enable generated answers. SHIRO pins the provider to `google/gemma-4-31b-it`; it does not accept a model override or call other endpoints. NVIDIA currently labels this model's hosted endpoint as free. Free endpoint availability and quotas are controlled by NVIDIA and can change. Without a key, SHIRO stays in local retrieval mode. The default port is 8001 and the server binds to loopback. SQLite data stays in `data/shiro.sqlite3`.

To stop the server, press Ctrl+C. Repository deletion removes the local database index and saved investigations. No downloaded source archive is retained after indexing.

## Product workflow

1. Choose **Connect repository** and enter a public URL such as `https://github.com/pallets/flask`.
2. Optionally choose a branch with `https://github.com/owner/repository/tree/branch`.
3. Ask SHIRO a question from the main conversation; matched excerpts link into the source file view.
4. Use the workspace rail and tabs to browse files, explore resolved relative import edges, or save an investigation.
5. Switch repositories from the sidebar or delete a local index when it is no longer needed.

## Ingestion limits and safety

- Accepts HTTPS GitHub repository URLs only, with strict owner/repository/branch parsing.
- Public GitHub metadata and ZIP endpoints are used. Redirects are restricted to GitHub-owned archive hosts.
- Compressed archive limit: 24 MB. Unpacked text source limit: 36 MB. Maximum 2,500 supported files; each file is limited to 500 KB.
- Skips dependency, generated, VCS and cache directories, symlinks, binary/invalid UTF-8 files, and unsupported extensions.
- Does not follow source links, install dependencies, or execute source code.
- The selected branch is resolved to a full Git commit SHA through the GitHub API, and the ZIP is then requested by that immutable SHA. Search answers carry this snapshot provenance.
- The loopback-only server has no authentication or CSRF defense and is not suitable for deployment or multi-user use.

## Index and retrieval behavior

Python files are parsed with `ast` for functions, async functions, classes, and imports. JavaScript and TypeScript use bounded regular-expression extraction for common declarations and import/require statements. Other supported formats are indexed as searchable text only. Relative imports are linked only when a matching indexed source path resolves; external and unresolved imports are omitted from the graph.

Search tokenizes the question, ranks exact path and content occurrences, and returns up to eight files with short real source excerpts. This is not vector retrieval or semantic search. With NVIDIA configured, SHIRO sends the question and those matched excerpts to the fixed free endpoint to draft an answer; the full repository index is not sent. The key stays in the local `.env` file and is never exposed to the browser. Without a key, answers are deterministic retrieval summaries. SHIRO abstains when no snippets match, even when the provider is configured. Verify generated answers against their source citations.

## API

The local API is documented by its implementation in `server.py`:

- `GET /api/health`
- `GET /api/repositories`
- `POST /api/repositories` — `{ "url": "https://github.com/owner/repo" }`
- `DELETE /api/repositories/{id}`
- `GET /api/repositories/{id}/files`
- `GET /api/repositories/{id}/file?path=...`
- `GET /api/repositories/{id}/graph`
- `POST /api/repositories/{id}/ask` — `{ "question": "..." }`
- `GET /api/repositories/{id}/investigations`
- `POST /api/repositories/{id}/investigations` — `{ "title": "...", "question": "..." }`

SQLite schema is initialized idempotently on server startup. There is no migration framework in this single-user prototype.

## Verification

Run the standard-library checks with:

```powershell
py -m unittest discover -s tests -v
py -m py_compile server.py
```

## Known limitations and next improvements

- No authentication, organization support, private GitHub integration, hosted deployment, or production job queue.
- Indexing runs synchronously in the request, so the bounded archive limits are intentionally modest.
- No incremental indexing, full-text database index, embeddings, or hybrid retrieval.
- JavaScript/TypeScript parsing is heuristic; call relationships and dynamic imports are not resolved.
- The app-first workspace does not include a separate public marketing site, deployment setup, usage telemetry, or an evaluation benchmark.
- Next: resolve and persist actual Git commit SHAs with safe incremental indexing; add GitHub OAuth plus per-user authorization and persistent background jobs; evaluate retrieval and citation coverage on a reproducible corpus before introducing grounded model answers.
