# StudyMate

AI-powered study assistant: upload notes → get summaries, flowcharts, quizzes, revision flashcards, a chat tutor, and plain-English medical report explanations.

🔗 **Live demo:** [studymate-frontend-beta.vercel.app](https://studymate-frontend-beta.vercel.app/)
📦 **Repo:** [github.com/vikas-g-10/studymate](https://github.com/vikas-g-10/studymate)

> Note: the deployed demo only supports **☁️ Cloud AI** mode (bring your own API key) — **💻 Local AI** mode requires running the app on your own machine with Ollama, since it connects to `localhost:11434`.

You can run the AI features two ways:
- **☁️ Cloud AI** — bring your own Anthropic or OpenRouter API key.
- **💻 Local AI** — run everything on your own machine with [Ollama](https://ollama.com), no API key or internet required for the AI calls.

---

## Structure

```
studymate/
├── frontend/          # React + Vite + Tailwind + shadcn/ui (deploy to Vercel)
│   ├── src/
│   │   ├── lib/anthropic.ts        # AI client — routes to Cloud (Anthropic/OpenRouter) or Local (Ollama)
│   │   ├── hooks/use-api-key.ts    # Stores your Cloud API key in localStorage
│   │   └── components/SettingsDialog.tsx  # AI Mode switch + API key entry (in-app)
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── vercel.json
│   ├── .env.example
│   └── package.json
├── backend/            # Supabase Edge Functions (Deno) — auth-related, deployed on Lovable Cloud
│   └── supabase/functions/
│       ├── chat/ summarize/ generate-flowchart/ quiz/ revision/ medical-report/
├── package.json         # root scripts
└── README.md
```

> **Note:** The AI features (summaries, quiz, revision, chat, flowchart, medical report) now run **client-side**, calling either Anthropic/OpenRouter directly or your local Ollama instance from the browser (`frontend/src/lib/anthropic.ts`). Supabase is used for user authentication/session storage.

---

## Quick start

```bash
# Install frontend deps
npm install --prefix frontend

# Copy env template and fill in values
cp frontend/.env.example frontend/.env

# Run dev server
npm run dev
```

Visit <http://localhost:8080>

Sign up / sign in, then open **Settings** (sidebar) to choose your AI mode and add a key — or set up Local AI (below).

---

## 💻 Local AI mode (run AI on your own machine, no API key)

Local AI mode sends your notes to a model running on your own computer via [Ollama](https://ollama.com), instead of a cloud API. Nothing leaves your machine, there's no per-token cost, and it works offline once the model is downloaded.

### 1. Install Ollama

Download and install Ollama for your OS: <https://ollama.com/download>

### 2. Pull the models StudyMate expects

StudyMate is hard-coded to use these two models:

```bash
ollama pull qwen2.5:7b        # text: summaries, quiz, revision, chat, flowcharts
ollama pull qwen2.5vl:3b      # vision: reading medical report images
```

### 3. Make sure Ollama is running and reachable

Ollama runs a local server at `http://localhost:11434` by default. Start it (it usually auto-starts after install, or run `ollama serve`).

Ollama's default config blocks requests from other origins. Since StudyMate calls it from your browser at `http://localhost:8080`, you need to allow that origin:

```bash
# macOS / Linux
OLLAMA_ORIGINS="http://localhost:8080" ollama serve

# Windows (PowerShell) — set it as a system env var, then restart Ollama
setx OLLAMA_ORIGINS "http://localhost:8080"
```

> If you deploy the frontend elsewhere (e.g. Vercel), Local AI mode only works when *you* are running the app from `localhost`, since your browser needs to reach the Ollama server on your own machine. It will not work for other visitors of a deployed site.

### 4. Enable Local AI in the app

1. Run StudyMate (`npm run dev`) and open it in your browser.
2. Click **Settings** in the sidebar.
3. Under **AI Mode**, select **💻 Local AI**.
4. Click **Test Local AI Connection** — it checks that Ollama is running and that `qwen2.5:7b` is installed.
5. Once it shows **✓ Local AI Connected**, all AI features (Summarize, Quiz, Revision, Chat, Flowchart, Medical Report) will run through your local Ollama instance.

You can switch back to **☁️ Cloud AI** at any time from the same Settings dialog.

### Local AI troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "Could not connect to Ollama. Make sure Ollama is running." | Ollama isn't running, or `OLLAMA_ORIGINS` doesn't include `http://localhost:8080` |
| "Qwen2.5 7B model was not found in Ollama." | Run `ollama pull qwen2.5:7b` |
| Medical report image upload fails in Local mode | Run `ollama pull qwen2.5vl:3b` — the vision model is separate from the text model |
| Slow first response | The model has to load into memory on first use; subsequent requests are faster |

---

## ☁️ Cloud AI mode (API key)

1. Get a free key from [OpenRouter](https://openrouter.ai/keys) (recommended, has a free tier) or a paid key from [Anthropic](https://console.anthropic.com/settings/keys).
2. Open **Settings** in the app, paste the key (`sk-or-...` or `sk-ant-...`), and click **Save Key**.
3. Your key is stored only in your browser's `localStorage` — it is never sent to StudyMate's own servers.

---

## Environment variables

### Frontend (`frontend/.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase / Lovable Cloud project URL (used for auth) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon (publishable) key — safe in client |
| `VITE_SUPABASE_PROJECT_ID` | Project ref |

No AI provider keys go in `.env` — Cloud AI keys are entered per-user in the Settings dialog and stored in the browser, and Local AI needs no key at all.

### Backend (Supabase secrets — set in Lovable Cloud dashboard, not committed)

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Auto-injected |
| `SUPABASE_ANON_KEY` | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected |

---

## Deployment

### Frontend → Vercel

1. Push the `studymate/` repo to GitHub.
2. On <https://vercel.com/new> → **Import** your repo.
3. Set **Root Directory** to `frontend`.
4. Framework preset auto-detects as **Vite**. Build command: `npm run build`. Output: `dist`.
5. Add the three `VITE_*` environment variables above.
6. Deploy. Vercel will give you a `*.vercel.app` URL.

Remember: on a deployed site, only **Cloud AI** mode works for other visitors — **Local AI** mode requires the visitor to have Ollama running on their own machine at `localhost:11434`.

### Backend → Lovable Cloud (already done)

The Edge Functions in `backend/supabase/functions/` are already deployed on Lovable Cloud and back the authentication flow.

- **No Render / no Express server needed.** Lovable Cloud hosts the Deno functions, handles TLS, CORS, and auto-scaling.
- To redeploy after edits, push through Lovable, or run `supabase functions deploy <name>` with the Supabase CLI.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start frontend dev server |
| `npm run build` | Build frontend for production |
| `npm run preview` | Preview production build |
| `npm run backend:serve` | Run Edge Functions locally (requires Supabase CLI) |
| `npm run backend:deploy` | Deploy all Edge Functions (requires `SUPABASE_PROJECT_REF`) |

---

## Tech

- React 18, Vite 5, TypeScript 5, Tailwind v3, shadcn/ui
- Supabase (auth) + Supabase Edge Functions (Deno) on Lovable Cloud
- AI: Anthropic Claude / OpenRouter (Cloud mode) or Ollama running `qwen2.5:7b` + `qwen2.5vl:3b` (Local mode)

---

## Scalability & maintainability suggestions

1. **Persist study sessions** — currently in `localStorage`. Add a `notes` table + RLS so users can access notes across devices.
2. **Rate-limit AI calls** — add a simple per-IP / per-user counter to prevent runaway usage on shared/Cloud-key deployments.
3. **Cache AI responses** — hash the input content + endpoint and cache the response; saves repeat calls.
4. **Lock down CORS** in production to your Vercel domain only.
5. **Split large components** — `QuizPlayer.tsx` and similar files can be broken into smaller hooks/subcomponents as features grow.
6. **Add E2E tests** — Playwright tests for the upload → summary → quiz flow, and for both AI modes.
