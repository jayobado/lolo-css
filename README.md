# lolo-css

A framework-agnostic atomic CSS-in-JS engine. Zero dependencies. Works with Vue, React, lolo-ui, or plain DOM.

## Install

```bash
# Deno
deno add @jayobado/lolo-css

# npm
npx jsr add @jayobado/lolo-css
```

## Usage

```typescript
import { css, globalStyles, globalReset } from '@jayobado/lolo-css'

// Reset and global styles
globalReset()

globalStyles({
  vars: { '--primary': '#2563eb', '--radius': '6px' },
  fonts: [
    { family: '"Inter"', src: 'url(/fonts/Inter.woff2) format("woff2")' },
  ],
  keyframes: {
    fadeIn: {
      from: { opacity: 0 },
      to:   { opacity: 1 },
    },
  },
  rules: {
    body: { fontFamily: 'var(--font-sans)', color: '#111' },
    a:    { color: 'var(--primary)', textDecoration: 'none' },
  },
})

// Atomic classes — deduplicated, one class per declaration
const card = css({
  display: 'flex',
  gap: 16,
  padding: 24,
  borderRadius: 'var(--radius)',

  pseudo: {
    ':hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  },

  media: {
    '(max-width: 768px)': { padding: 12 },
  },
})
```

## API

### Atomic CSS

- **`css(style)`** — generates atomic class names from a style object. Returns a space-separated class string.
- **`staticCss(style)`** — alias for `css()`.

### Global CSS

- **`globalCss(rules)`** — inject raw CSS string (deduplicated).
- **`globalStyle(selector, props)`** — inject a rule for a selector using typed `StyleProperties`.
- **`globalVars(vars, selector?)`** — inject CSS custom properties on `:root` (or a custom selector).
- **`globalKeyframes(name, frames)`** — inject a `@keyframes` rule.
- **`globalFontFace(font)`** — inject an `@font-face` rule from a typed `FontFace` object.
- **`globalReset()`** — inject a sensible CSS reset.
- **`globalStyles(options)`** — batch API: declare `rules`, `fonts`, `keyframes`, `vars`, and `raw` CSS in one call.

### SSR

- **`collectStyles()`** — returns a `<style>` tag string containing all rules generated during SSR.
- **`resetStyles()`** — clears server-side rule buffer between requests.
- **`snapshotCounter()` / `restoreCounter(n)`** — save and restore the class name counter for deterministic SSR output.

### Types

- **`StyleProperties`** — all supported CSS properties (camelCase). Includes `[custom: \`--\${string}\`]: CSSValue` for custom properties.
- **`StyleObject`** — extends `StyleProperties` with `pseudo` and `media` records.
- **`FontFace`** — typed font-face declaration (`family`, `src`, `weight?`, `style?`, `display?`).
- **`GlobalStylesOptions`** — options for the `globalStyles()` batch API.

## How it works

Each property+value pair generates a single atomic class (e.g. `._0 { padding: 16px; }`). Identical declarations share the same class — rules are never duplicated. On the client, rules are injected into a `<style>` element via `CSSStyleSheet.insertRule`. On the server, rules accumulate in a map and are collected with `collectStyles()`.

Numbers are converted to `px` except for unitless properties (`opacity`, `zIndex`, `fontWeight`, `lineHeight`, `flexGrow`, `flexShrink`, `gridColumn`, `gridRow`, `order`, `columnCount`, `animationIterationCount`).

Custom properties (`--*`) pass through without kebab conversion or `px` suffixing.

## License

MIT License © 2026 Jeremy Obado