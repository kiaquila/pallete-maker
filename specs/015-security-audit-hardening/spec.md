# Spec 015 — Security Audit Hardening: SHA-pin, CSP, DOM ops

## Problem

Security audit по всем публичным репо kiaquila (2026-04-24) выявил 2 Medium и 3 Low находки в pallete-maker. Risk Level: LOW, Critical/High = 0.

- **Medium #1** — first-party GitHub Actions (`actions/checkout`, `actions/setup-node`, `actions/github-script`) используют floating major tags (`@v6`, `@v4`, `@v8`). Moving tags можно перенаправить; SHA нельзя. Третьи actions уже SHA-пиннуты (spec 008 + 013), first-party оставались на тегах по прежней политике.
- **Medium #2** — CSP в `vercel.json` содержит `'unsafe-inline'` в обоих `script-src` и `style-src`. Это следствие инлайновых `<style>` (243 строки) и `<script type="module">` (435 строк) внутри `index.html`. `'unsafe-inline'` обнуляет большую часть XSS-защиты CSP.
- **Low #1** — два использования `innerHTML = ""` в `src/scripts/app.mjs` (в момент аудита — в `index.html`) для очистки DOM. Безопасно (пустая строка), но `replaceChildren()` — pure DOM API без HTML-парсинга, лучше по gestalt.
- **Low #3** — `id-token: write` в `claude-agent.yml` и `claude-review.yml`. Этот scope нужен только для OIDC federation. `anthropics/claude-code-action` использует `anthropic_api_key` (прямой API key), OIDC не требуется.
- **Low #2** — self-host Inter font. Google Fonts использует динамически генерируемые CSS, SRI неприменим. Риск минимален, скипнуто.

Транзитивная зависимость `postcss@8.5.9` (через `tailwindcss`) имеет известную уязвимость GHSA-qx2v-qp2m-jg93 (CVSS 6.1, Medium). Фикс в 8.5.10. OSV Scanner блокирует PR.

## Goals

- Все first-party GitHub Actions пиннуты по full commit SHA с trailing `# v<tag>` комментарием.
- CSP без `'unsafe-inline'`: инлайн `<style>` и `<script>` вынесены в `src/styles/app.css` и `src/scripts/app.mjs`, подключены через `<link>` / `<script src>`.
- Оба `innerHTML = ""` заменены на `replaceChildren()`.
- `id-token: write` удалён из `claude-agent.yml` и `claude-review.yml`.
- `postcss` форсирован на `>=8.5.10` через `pnpm.overrides` для устранения CVE.
- Приложение работает без функциональных изменений. Сборка остаётся deployable как статический сайт.

## Non-goals

- Self-host Inter font (Low #2). SRI неприменим, риск минимален.
- CSP с nonce/hash вместо `'self'`-external-files. Внешние файлы проще и достаточны.
- Аудит/правка транзитивных зависимостей за пределами postcss. OSV Scanner отслеживает остальное.

## Acceptance criteria

- В `.github/workflows/ci.yml`, `pr-guard.yml`, `claude-agent.yml`, `claude-review.yml`, `ai-review.yml`, `ai-command-policy.yml`, `osv-scan.yml` все `actions/checkout`, `actions/setup-node`, `actions/github-script` пиннуты по SHA с `# v<tag>` комментарием.
- `vercel.json` CSP: `script-src 'self' https://cdnjs.cloudflare.com/ajax/libs/html2canvas/; style-src 'self' https://fonts.googleapis.com` (без `'unsafe-inline'`).
- `index.html` содержит только `<link rel="stylesheet" href="src/styles/app.css" />` и `<script type="module" src="src/scripts/app.mjs"></script>` вместо инлайновых блоков.
- `src/styles/app.css` и `src/scripts/app.mjs` созданы с соответствующим контентом. Import path в app.mjs: `"./harmony.mjs"` (относительно src/scripts/).
- Оба `DOM.grid.innerHTML = ""` и `DOM.palette.innerHTML = ""` заменены на `replaceChildren()`.
- `claude-agent.yml` и `claude-review.yml` не содержат `id-token: write` в `permissions:` блоке.
- `package.json` содержит `pnpm.overrides.postcss: ">=8.5.10"`. `pnpm-lock.yaml` регенерирован.
- `pnpm run preflight` зелёный локально (59 тестов).
- OSV Scanner пасс (GHSA-qx2v-qp2m-jg93 устранён).
- Все PR checks COMPLETED + SUCCESSFUL: baseline-checks, guard, osv-scan, AI Review (Codex), Vercel.
