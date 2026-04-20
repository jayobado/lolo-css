// style.ts
// Framework-agnostic atomic CSS-in-JS engine.
// Zero dependencies. Works in any TypeScript/JavaScript project.
// Use collectStyles() + resetStyles() for SSR,
// or just css() / staticCss() for client-only apps.

type CSSValue = string | number

// ─── Types ───────────────────────────────────────────────────────────────────

/** All supported CSS properties in camelCase. Custom properties (`--*`) are also accepted. */
export interface StyleProperties {
	[custom: `--${string}`]: CSSValue

	display?: string; flexDirection?: string; flexWrap?: string; flex?: CSSValue
	flexGrow?: CSSValue; flexShrink?: CSSValue; flexBasis?: CSSValue
	alignItems?: string; alignSelf?: string; justifyContent?: string
	justifySelf?: string; gap?: CSSValue; rowGap?: CSSValue; columnGap?: CSSValue
	gridTemplateColumns?: CSSValue; gridTemplateRows?: CSSValue
	gridColumn?: CSSValue; gridRow?: CSSValue; gridArea?: CSSValue
	width?: CSSValue; minWidth?: CSSValue; maxWidth?: CSSValue
	height?: CSSValue; minHeight?: CSSValue; maxHeight?: CSSValue
	padding?: CSSValue; paddingTop?: CSSValue; paddingRight?: CSSValue
	paddingBottom?: CSSValue; paddingLeft?: CSSValue; paddingInline?: CSSValue
	paddingBlock?: CSSValue; margin?: CSSValue; marginTop?: CSSValue
	marginRight?: CSSValue; marginBottom?: CSSValue; marginLeft?: CSSValue
	marginInline?: CSSValue; marginBlock?: CSSValue
	position?: string; top?: CSSValue; right?: CSSValue; bottom?: CSSValue
	left?: CSSValue; zIndex?: CSSValue; inset?: CSSValue
	fontSize?: CSSValue; fontWeight?: CSSValue; fontFamily?: CSSValue
	fontStyle?: string; lineHeight?: CSSValue; letterSpacing?: CSSValue
	textAlign?: string; textDecoration?: CSSValue; textTransform?: string
	textOverflow?: string; whiteSpace?: string; color?: CSSValue
	background?: CSSValue; backgroundColor?: CSSValue; backgroundImage?: CSSValue
	border?: CSSValue; borderTop?: CSSValue; borderRight?: CSSValue
	borderBottom?: CSSValue; borderLeft?: CSSValue; borderRadius?: CSSValue
	borderColor?: CSSValue; borderWidth?: CSSValue; borderStyle?: string
	outline?: CSSValue; outlineOffset?: CSSValue
	boxShadow?: CSSValue; opacity?: CSSValue; overflow?: string
	overflowX?: string; overflowY?: string; cursor?: CSSValue
	pointerEvents?: string; userSelect?: string; visibility?: string
	transform?: CSSValue; transformOrigin?: CSSValue; transition?: CSSValue
	animation?: CSSValue; filter?: CSSValue; backdropFilter?: CSSValue
	willChange?: CSSValue; clipPath?: CSSValue; appearance?: CSSValue
	resize?: string; listStyle?: CSSValue; objectFit?: string
	verticalAlign?: CSSValue; content?: CSSValue; boxSizing?: string
	aspectRatio?: CSSValue; wordBreak?: string
}

/** Style object with optional pseudo-class and media query blocks. */
export interface StyleObject extends StyleProperties {
	pseudo?: Record<string, StyleProperties>
	media?: Record<string, StyleProperties>
}

/** Typed font-face declaration. */
export interface FontFace {
	family: string
	src: string
	weight?: CSSValue
	style?: string
	display?: string
}

/** Options for the `globalStyles()` batch API. */
export interface GlobalStylesOptions {
	rules?: Record<string, StyleProperties>
	fonts?: FontFace[]
	keyframes?: Record<string, Record<string, StyleProperties>>
	vars?: Record<string, string>
	varsSelector?: string
	raw?: string
}

// ─── Engine internals ────────────────────────────────────────────────────────

const IS_SERVER = typeof document === 'undefined'
const ruleCache = new Map<string, string>()
const serverRules = new Map<string, string>()
const clientInjected = new Set<string>()
const globalCache = new Set<string>()

let styleEl: HTMLStyleElement | null = null
let counter = 0

function kebab(s: string): string {
	if (s.startsWith('--')) return s
	return s.replace(/([A-Z])/g, '-$1').toLowerCase()
}

const unitless = new Set([
	'animationIterationCount', 'columnCount', 'flexGrow', 'flexShrink',
	'fontWeight', 'gridColumn', 'gridRow', 'lineHeight', 'opacity',
	'order', 'zIndex',
])

function val(prop: string, v: CSSValue): string {
	if (prop.startsWith('--')) return String(v)
	return typeof v === 'number' && v !== 0 && !unitless.has(prop)
		? `${v}px`
		: String(v)
}

function genCls(): string {
	return `_${(counter++).toString(36)}`
}

function ensureStyleEl(): void {
	if (styleEl) return
	styleEl = document.createElement('style')
	styleEl.id = '__css__'
	document.head.appendChild(styleEl)
}

function insertClient(rule: string): void {
	ensureStyleEl()
	try {
		styleEl!.sheet!.insertRule(rule, styleEl!.sheet!.cssRules.length)
	} catch { /* skip invalid rules */ }
}

function injectClient(cls: string, rule: string): void {
	if (clientInjected.has(cls)) return
	clientInjected.add(cls)
	insertClient(rule)
}

function registerRule(key: string, cls: string, rule: string): void {
	ruleCache.set(key, cls)
	if (IS_SERVER) {
		serverRules.set(cls, rule)
	} else {
		injectClient(cls, rule)
	}
}

function processProps(
	props: StyleProperties,
	makeSelector: (cls: string) => string,
	keyPrefix: string,
	classes: string[],
): void {
	for (const [prop, value] of Object.entries(props)) {
		if (value == null) continue
		const key = `${keyPrefix}:${prop}:${value}`
		if (!ruleCache.has(key)) {
			const cls = genCls()
			const decl = `${kebab(prop)}:${val(prop, value as CSSValue)}`
			const rule = `${makeSelector(cls)}{${decl};}`
			registerRule(key, cls, rule)
		}
		classes.push(ruleCache.get(key)!)
	}
}

function hashRule(rule: string): string {
	let h = 0
	for (let i = 0; i < rule.length; i++) {
		h = ((h << 5) - h + rule.charCodeAt(i)) | 0
	}
	return `_g${(h >>> 0).toString(36)}`
}

function splitRules(raw: string): string[] {
	const rules: string[] = []
	let depth = 0
	let start = 0

	for (let i = 0; i < raw.length; i++) {
		if (raw[i] === '{') depth++
		if (raw[i] === '}') {
			depth--
			if (depth === 0) {
				const rule = raw.slice(start, i + 1).trim()
				if (rule) rules.push(rule)
				start = i + 1
			}
		}
	}

	return rules
}

function propsToDeclarations(props: StyleProperties): string {
	return Object.entries(props)
		.filter(([, v]) => v != null)
		.map(([p, v]) => `${kebab(p)}:${val(p, v as CSSValue)}`)
		.join(';')
}

function injectGlobalRule(rule: string): void {
	if (IS_SERVER) {
		const id = hashRule(rule)
		serverRules.set(id, rule)
	} else {
		insertClient(rule)
	}
}

// ─── Public API: Atomic CSS ──────────────────────────────────────────────────

/**
 * Generate atomic class names from a style object.
 * Returns a space-separated class string.
 *
 * @example
 * ```ts
 * const cls = css({ display: 'flex', gap: 16, padding: 24 })
 * // cls = '_0 _1 _2'
 * ```
 */
export function css(style: StyleObject): string {
	const classes: string[] = []
	const { pseudo, media, ...base } = style

	processProps(base as StyleProperties, cls => `.${cls}`, 'b', classes)

	if (pseudo) {
		for (const [sel, props] of Object.entries(pseudo)) {
			if (!props) continue
			processProps(props, cls => `.${cls}${sel}`, `p:${sel}`, classes)
		}
	}

	if (media) {
		for (const [query, props] of Object.entries(media)) {
			if (!props) continue
			for (const [prop, value] of Object.entries(props)) {
				if (value == null) continue
				const key = `m:${query}:${prop}:${value}`
				if (!ruleCache.has(key)) {
					const cls = genCls()
					const decl = `${kebab(prop)}:${val(prop, value as CSSValue)}`
					const rule = `@media ${query}{.${cls}{${decl};}}`
					registerRule(key, cls, rule)
				}
				classes.push(ruleCache.get(key)!)
			}
		}
	}

	return classes.join(' ')
}

/** Alias for `css()`. */
export function staticCss(style: StyleObject): string {
	return css(style)
}

// ─── Public API: Global CSS ──────────────────────────────────────────────────

/** Inject raw CSS string. Deduplicated by content hash. */
export function globalCss(rules: string): void {
	const trimmed = rules.trim()
	if (!trimmed) return
	const id = hashRule(trimmed)
	if (globalCache.has(id)) return
	globalCache.add(id)

	if (IS_SERVER) {
		serverRules.set(id, trimmed)
	} else {
		for (const rule of splitRules(trimmed)) {
			insertClient(rule)
		}
	}
}

/** Inject a rule for a selector using typed `StyleProperties`. */
export function globalStyle(selector: string, props: StyleProperties): void {
	const decls = propsToDeclarations(props)
	if (!decls) return
	const rule = `${selector}{${decls};}`
	const id = hashRule(rule)
	if (globalCache.has(id)) return
	globalCache.add(id)
	injectGlobalRule(rule)
}

/** Inject CSS custom properties on `:root` (or a custom selector). */
export function globalVars(vars: Record<string, string>, selector: string = ':root'): void {
	const decls = Object.entries(vars)
		.map(([k, v]) => `${k.startsWith('--') ? k : `--${k}`}:${v}`)
		.join(';')
	const rule = `${selector}{${decls};}`
	const id = hashRule(rule)
	if (globalCache.has(id)) return
	globalCache.add(id)
	injectGlobalRule(rule)
}

/** Inject a `@keyframes` rule. */
export function globalKeyframes(name: string, frames: Record<string, StyleProperties>): void {
	const body = Object.entries(frames)
		.map(([stop, props]) => `${stop}{${propsToDeclarations(props)}}`)
		.join('')
	const rule = `@keyframes ${name}{${body}}`
	const id = hashRule(rule)
	if (globalCache.has(id)) return
	globalCache.add(id)
	injectGlobalRule(rule)
}

/** Inject an `@font-face` rule from a typed `FontFace` object. */
export function globalFontFace(font: FontFace): void {
	const decls = [
		`font-family:${font.family}`,
		`src:${font.src}`,
		font.weight != null ? `font-weight:${font.weight}` : '',
		font.style ? `font-style:${font.style}` : '',
		`font-display:${font.display ?? 'swap'}`,
	].filter(Boolean).join(';')
	const rule = `@font-face{${decls}}`
	const id = hashRule(rule)
	if (globalCache.has(id)) return
	globalCache.add(id)
	injectGlobalRule(rule)
}

/** Inject a sensible CSS reset. */
export function globalReset(): void {
	globalCss(`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { line-height: 1.5; -webkit-font-smoothing: antialiased; }
    img, picture, video, canvas, svg { display: block; max-width: 100%; }
    input, button, textarea, select { font: inherit; }
    p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }
  `)
}

/**
 * Batch API — declare all globals in a single call.
 *
 * @example
 * ```ts
 * globalStyles({
 *   vars: { '--primary': '#2563eb' },
 *   fonts: [{ family: '"Inter"', src: 'url(/fonts/Inter.woff2) format("woff2")' }],
 *   keyframes: { fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } } },
 *   rules: { body: { fontFamily: 'Inter, system-ui, sans-serif' } },
 * })
 * ```
 */
export function globalStyles(options: GlobalStylesOptions): void {
	if (options.fonts) {
		for (const font of options.fonts) globalFontFace(font)
	}

	if (options.keyframes) {
		for (const [name, frames] of Object.entries(options.keyframes)) {
			globalKeyframes(name, frames)
		}
	}

	if (options.vars) {
		globalVars(options.vars, options.varsSelector)
	}

	if (options.rules) {
		for (const [selector, props] of Object.entries(options.rules)) {
			globalStyle(selector, props)
		}
	}

	if (options.raw) {
		globalCss(options.raw)
	}
}

// ─── Public API: SSR ─────────────────────────────────────────────────────────

/** Returns a `<style>` tag string containing all rules generated during SSR. */
export function collectStyles(): string {
	if (!IS_SERVER) return ''
	const rules = [...serverRules.values()].join('\n')
	return `<style id="__css__">${rules}</style>`
}

/** Clears server-side rule buffer between requests. */
export function resetStyles(): void {
	if (!IS_SERVER) return
	serverRules.clear()
}

/** Save the current class name counter (for deterministic SSR). */
export function snapshotCounter(): number { return counter }

/** Restore the class name counter (for deterministic SSR). */
export function restoreCounter(n: number): void { counter = n }