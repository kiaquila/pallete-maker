# Delivery Playbook

> Audience: all agents. Canonical source for: preview validation checklist, merge rule, production smoke. Prereq: `ai-pr-workflow.md`. Next: `vercel-cd.md` (deploy contract).

This playbook covers preview validation before merge and production smoke after
merge.

## Preview Checklist

For any app-facing PR, verify on the Vercel preview:

- palette grid loads without layout breakage
- base color picker works and generates palette correctly
- harmony rule selection updates the grid
- primary mobile viewport still works
- PNG export downloads a correct palette image
- no obvious missing assets or broken links appear

## Merge Rule

Do not merge while any of these are true:

- required GitHub checks are pending or failing
- the active review backend has unresolved blocking findings
- the Vercel preview is failing or visibly broken for the changed flow

## Production Smoke

After merge to `main`, verify the production URL documented in
`VERCEL_PRODUCTION_DOMAIN`.

Minimum smoke:

- palette grid loads and renders colors
- harmony logic produces correct palette for a known base color
- PNG export works on desktop and mobile

If production smoke fails, treat it as an active incident and recover through a
new PR rather than a direct Vercel dashboard edit.
