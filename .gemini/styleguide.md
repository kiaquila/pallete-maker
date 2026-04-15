# Gemini Review Style Guide

Prioritize:

- mobile palette grid reflow regressions (column counts vs. 88px swatch size)
- PM Harmony rules correctness (`isCompatible`, group/temperature semantics,
  achromatic-first-click handling, Variant A base removal)
- Warm / Cool / Universal sectioning in the bottom drawer and PNG export
- Itten hue coverage (≥12 hues per chromatic base under the current rule)
- PNG export safety (html2canvas invocation, fresh detached stage per call)
- RU UI copy consistency
- build and deploy safety for Vercel
- CDN dependency risks (html2canvas, Tailwind) and maintainability

Do not block on style-only nitpicks.
