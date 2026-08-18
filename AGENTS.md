# account_book project instructions

## Deployment

- Deploy this project only with GitHub Pages from `sorryrlrud/account-book-pwa`.
- The canonical production URL is `https://sorryrlrud.github.io/account-book-pwa/`.
- Do not create, configure, inspect, or deploy a ChatGPT Site for this project.
- Do not add `.openai/hosting.json`, Sites/Cloudflare Worker build output, or Sites packaging scripts.
- `main` pushes run `.github/workflows/deploy-pages.yml`; use that workflow for production releases.
- Before a release, run `npm run check`. A successful push to `main` is sufficient authorization for the Pages deployment; do not add a separate production approval gate.

## Access and Sheet policy

- The static GitHub Pages shell is public. Ledger data remains protected by Google OAuth and Google Sheet sharing permissions.
- The intended users are the two Google accounts that have access to the connected Sheet. Do not build a separate app-level account or allowlist system unless explicitly requested.
- The configured bootstrap workbook is a TEST workbook. Routine reads, writes, migrations, and live verification against that configured workbook are allowed after normal OAuth access and schema validation.
- `앱설정.environment = TEST` is descriptive metadata, not an additional write gate.
- Do not require repeated warnings or manual approval merely because an operation writes to the configured TEST workbook.
- Never substitute, discover, or connect a real/original household ledger workbook without an explicit user request that identifies the target.

## Safety that remains required

- Keep Google access checks, required-sheet/schema validation, and linked-year graph validation.
- Keep protections against duplicate or ambiguous financial writes, including no blind automatic replay of failed mutations.
- Keep confirmations for destructive or broad data changes such as delete, bulk rename, carry-over reset, and month-zero synchronization.
- Never commit OAuth tokens, client secrets, or ledger data. Browser tokens remain session-scoped.
