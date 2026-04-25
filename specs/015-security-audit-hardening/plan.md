# Plan — 015-security-audit-hardening

## Approach

Батч из 5 независимых security-правок в одном PR. Каждая слишком мала для отдельного PR, все имеют одинаковый risk profile (none/low), и все относятся к одному аудиту.

### A. SHA-pin first-party Actions

1. Резолвить SHA через `gh api repos/actions/<name>/commits/<tag> --jq '.sha'` для checkout@v6, checkout@v4, setup-node@v4, github-script@v8.
2. Заменить `uses: actions/<name>@<tag>` → `uses: actions/<name>@<sha> # <tag>` во всех 7 workflow-файлах. Для файлов с несколькими вхождениями одного action (claude-agent.yml: 3× checkout, claude-review.yml: 2× checkout) использовать `replace_all`.
3. Верифицировать `grep -rn "uses: actions/checkout@v\|uses: actions/setup-node@v\|uses: actions/github-script@v" .github/workflows/` возвращает пусто.

### B. CSP — вынос inline в external files

1. Создать `src/styles/app.css` с контентом из `<style>` блока (lines 22-265 старого index.html). Сохранить `@import url("https://fonts.googleapis.com/...")` — это `style-src` fetch, разрешается через `https://fonts.googleapis.com` в CSP.
2. Создать `src/scripts/app.mjs` с контентом из `<script type="module">` блока (lines 336-771). **Критично:** поправить import path `"./src/scripts/harmony.mjs"` → `"./harmony.mjs"` (теперь относительно `src/scripts/app.mjs`, оба в одной папке).
3. В `index.html`: заменить `<style>...</style>` на `<link rel="stylesheet" href="src/styles/app.css" />`, `<script type="module">...</script>` на `<script type="module" src="src/scripts/app.mjs"></script>`. Использовать node-регексп для надёжной замены больших блоков (Edit тул плохо работает с 200+ строчными strings).
4. Обновить `vercel.json` CSP: убрать `'unsafe-inline'` из `script-src`. Оставить в `style-src` — runtime CSSOM через `element.style.cssText` (swatches, export stage) требует его. Удаление blocks layout palette drawer и PNG export (подтверждено Codex P1 на первой итерации). Итоговый CSP: `default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com/ajax/libs/html2canvas/; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. Миграция cssText → classes — отдельный spec.

### C. `innerHTML = ""` → `replaceChildren()`

Два точечных edit в `src/scripts/app.mjs`:

- `DOM.grid.innerHTML = "";` → `DOM.grid.replaceChildren();` (функция `renderGrid`)
- `DOM.palette.innerHTML = "";` → `DOM.palette.replaceChildren();` (функция `updatePaletteUI`)

### D. Убрать `id-token: write`

Проверить README `anthropics/claude-code-action`: использует ли OIDC? Ответ: нет, использует `anthropic_api_key`. Удалить строку `id-token: write` из `permissions:` блока в:

- `.github/workflows/claude-agent.yml`
- `.github/workflows/claude-review.yml`

### E. Bump postcss via pnpm override

postcss — транзитивная (через tailwindcss → постинтегрированные препроцессоры), `pnpm update postcss` не сработал. Добавить в `package.json`:

```json
"pnpm": {
  "overrides": {
    "postcss": ">=8.5.10"
  }
}
```

Запустить `pnpm install` для регенерации `pnpm-lock.yaml`. OSV Scanner верифицирует resolved version.

## Risks

- **CSS `@import` под CSP.** Браузер при загрузке `app.css` делает fetch `fonts.googleapis.com`. Это CSS-level import, контролируется `style-src`. В обновлённом CSP `fonts.googleapis.com` остаётся в `style-src` — не ломает. Проверить в DevTools после deploy.
- **Import path shift.** Если забыть поправить `"./src/scripts/harmony.mjs"` → `"./harmony.mjs"` в `app.mjs`, модуль не загрузится и вся app сломается. Проверено: `src/scripts/app.mjs` и `src/scripts/harmony.mjs` в одной папке, relative path корректен.
- **Prettier formatting на новом файле.** `app.mjs` первично написан с inline-индентацией из HTML; prettier может переформатировать (например, склеить длинные if-блоки). Решение: после Write запустить `pnpm exec prettier --write src/scripts/app.mjs` перед commit.
- **pnpm override side-effects.** Override форсирует `postcss>=8.5.10` для всех зависимостей. tailwindcss 3.4.19 peer-depends на `postcss: ^8.0.0` — диапазон совпадает. Риск регрессии в build: низкий, проверяется `pnpm run build`.
- **Large block replacement в index.html.** Edit тул падает на 200+ строчных `old_string`. Используется node-regex в `Bash`: `html.replace(/<style>[\s\S]*?<\/style>/, '<link ...>')`. Non-greedy, уникальная пара тегов.

## Done when

- Все Spec 015 acceptance criteria met.
- `pnpm run preflight` зелёный локально.
- PR #19 checks: baseline-checks, guard, osv-scan, AI Review (Codex), Vercel — все COMPLETED + SUCCESSFUL.
- Ручная проверка preview deploy: открыть палитру, добавить цвета, export PNG, DevTools Console без CSP violations, Network показывает `app.css` и `app.mjs` как отдельные 200-ответы.
