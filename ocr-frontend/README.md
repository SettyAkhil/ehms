# Keppler OCR — frontend

The Keppler Medical Document Intelligence UI (OCR, PDF summarizer, RAG assistant, document vault).
It is a separate React app, embedded in the hospital app as **Hosp AI → Keppler OCR** (an iframe at
`/keppler-ocr/`), and signs in silently with the shared `hms-embed` account (`src/app/lib/auth-context.tsx`).

| | |
|---|---|
| Stack | React 19, Vite 6, Tailwind 4, `@figma/astraui` theme, Radix dropdown, lucide icons |
| Dev server | `:3000`, base path `/keppler-ocr/` — started by `npm run dev` at the repo root |
| API | `/api/v1/*`, proxied to ocr-backend `:7620` (`vite.config.ts`) |
| Config | optional `.env` — see [.env.example](.env.example) |

```bash
npm ci                         # install
npx vite --port 3000           # run alone
npm run build                  # production build (deploy/web/Dockerfile does this)
```

Code: `src/app/App.tsx` (whole UI), `src/app/lib/api.ts` (backend client), `src/styles/` (theme).
Licences of bundled assets: [ATTRIBUTIONS.md](ATTRIBUTIONS.md). Repo-wide docs: [../README.md](../README.md).
