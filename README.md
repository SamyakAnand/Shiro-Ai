# SHIRO CodeMind

**Every Codebase Has a Pattern. SHIRO Finds It.**

SHIRO is an app-first codebase intelligence workspace. Connect a public GitHub repository, explore its files and parser-derived imports, ask source-grounded questions, and make reusable study outputs. There is no marketing landing page. SHIRO is read-only: indexed repository code is never executed.

## Workspace features

- **Ask SHIRO:** search an indexed snapshot and follow citations into real source lines.
- **Files:** browse the bounded code index and inspect source.
- **Connections:** switch between resolved import relationships and a folder/symbol mind map. Folder structure comes from indexed paths; import links are parser-derived and incomplete.
- **Studio:** generate source-cited repository briefings, architecture walkthroughs, feature traces, bug investigations, flashcards, and quizzes. Reopen or delete saved outputs; export reports as Markdown. Each artifact records its exact indexed commit.
- **Guided tour:** a skippable, restartable walkthrough advances only after the user completes the repository, source, visualization, citation, and Studio actions.
- **GitHub:** import public repositories. GitHub OAuth in hosted mode authenticates a SHIRO account only; SHIRO does not request private repository access.

Generated reports, cards, and quizzes require `NVIDIA_API_KEY`. SHIRO sends only bounded, retrieved source excerpts to its pinned NVIDIA model endpoint; it validates every returned file path and line range before saving. If evidence is missing, the request is rejected with a recovery hint. The mind map does not need a model provider.

## Local development

Requirements: Python 3.10 or newer and Node.js 20 or newer.

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
npm run build
py server.py
```

Open <http://127.0.0.1:8001>. The server binds to loopback, uses SQLite in `data/shiro.sqlite3`, and serves the source UI from `web/`. Add `NVIDIA_API_KEY` to the ignored local `.env` file to enable answer and Studio generation. The key stays on the server. SHIRO pins the model to `google/gemma-4-31b-it`; quotas and free endpoint availability are controlled by NVIDIA and may change.

The browser loads the pinned Supabase JavaScript client (`@supabase/supabase-js@2.118.0`) only when hosted mode is active. Local mode needs no Supabase project or OAuth configuration.

## Deploy on Vercel

The repository includes a static build, Vercel Python API entrypoint, and Supabase migration. Vercel's local filesystem is not used for hosted persistence; hosted mode requires Supabase Postgres, Auth, and all required environment variables. It fails closed instead of using SQLite if the hosted environment is incomplete.

### 1. Prepare Supabase

1. Create a Supabase project.
2. In **Authentication → Sign In / Providers**, enable GitHub and provide the GitHub OAuth app client ID and secret.
3. For the GitHub OAuth app, set its authorization callback URL to the callback URL shown in the Supabase GitHub provider settings (`https://<project-ref>.supabase.co/auth/v1/callback`).
4. Add your eventual Vercel production URL and preview URLs to Supabase Auth's redirect allowlist.
5. Apply `supabase/migrations/20261017140616_shiro_hosted_storage.sql` to the project. With the Supabase CLI, link the project and run `npx supabase db push`; otherwise run the migration in the Supabase SQL editor.
6. In the Supabase **Connect** panel, copy the transaction pooler URI for `DATABASE_URL`. Use transaction mode for Vercel's short-lived functions.

The migration gives each repository a Supabase Auth owner, enables and forces RLS on all repository tables, and scopes child rows through their parent repository. Each hosted request validates its bearer token with Supabase Auth, starts a transaction as the `authenticated` role, and sets the validated user claim for the RLS policies. The Python API also filters repository lists by owner. The service-role key is not used.

### 2. Configure Vercel

Import `SamyakAnand/Shiro-Ai` into Vercel, or deploy this repository as a Vercel project. The checked-in configuration builds static files from `web/` and routes `/api/*` through the Python function in `api/index.py`.

Add these Vercel project environment variables in every environment you plan to use:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Project URL, for example `https://<project-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key; safe to expose to the browser |
| `DATABASE_URL` | Supabase transaction pooler URI, with its database password stored only in Vercel |
| `NVIDIA_API_KEY` | Optional key for generated answers and Studio reports/cards/quizzes |

Never use or expose a Supabase service-role key. After Vercel variables and Supabase settings are saved, redeploy. Check `/api/health`; it reports missing configuration names but never returns credentials. Sign in through the GitHub button inside the SHIRO workspace, connect a **public** repository, and verify that its files and saved artifacts persist after a later function request.

### 3. Operational limits

- Indexing and NVIDIA generation run synchronously inside a Vercel function; the function timeout is configured to 60 seconds. Very large archives or slow upstream services can exceed it.
- Vercel hosting has not been considered live until Supabase migration, GitHub OAuth, Vercel environment variables, build, sign-in, RLS isolation, and data persistence are verified in the real projects.
- No production queue, private GitHub source access, incremental indexing, web research, audio, or video output is included.

## Source indexing and evidence

- Accepts HTTPS public GitHub URLs only. Redirects are restricted to GitHub-owned archive hosts.
- Limits: 24 MB compressed, 36 MB unpacked text, 2,500 supported files, 500 KB per file.
- Skips generated/dependency/cache directories, symlinks, binary files, invalid UTF-8, and unsupported extensions.
- Resolves the selected branch to an immutable commit SHA. Saved Studio content keeps that provenance.
- Python is parsed with `ast`; JavaScript and TypeScript use bounded heuristics. Dynamic imports and call relationships are not resolved.
- Retrieval returns at most eight relevant source files with short excerpts. The full repository is not sent to NVIDIA.

## API

- `GET /api/config`, `GET /api/health`
- `GET /api/repositories`, `POST /api/repositories`, `DELETE /api/repositories/{id}`
- `GET /api/repositories/{id}/files`, `GET /api/repositories/{id}/file?path=...`
- `GET /api/repositories/{id}/graph`, `GET /api/repositories/{id}/mindmap`
- `POST /api/repositories/{id}/ask`
- `GET /api/repositories/{id}/investigations`, `POST /api/repositories/{id}/investigations`
- `GET /api/repositories/{id}/artifacts`, `POST /api/repositories/{id}/artifacts`, `DELETE /api/repositories/{id}/artifacts/{artifact_id}`

## Verify

```powershell
py -m unittest discover -s tests -v
py -m py_compile server.py api/index.py
node --check web/app.js
npm run build
```
