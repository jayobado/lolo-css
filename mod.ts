/**
 * Framework-agnostic atomic CSS-in-JS engine.
 * Zero dependencies. Works in any TypeScript/JavaScript project.
 *
 * @example
 * ```ts
 * import { css, globalStyles, globalReset } from '@jayobado/lolo-css'
 *
 * globalReset()
 * globalStyles({
 *   vars: { '--primary': '#2563eb' },
 *   rules: { body: { fontFamily: 'Inter, system-ui, sans-serif' } },
 * })
 *
 * const card = css({ padding: 16, borderRadius: 8, display: 'flex', gap: 12 })
 * ```
 *
 * @module
 */

export {
	css,
	staticCss,
	globalCss,
	globalStyle,
	globalVars,
	globalKeyframes,
	globalFontFace,
	globalReset,
	globalStyles,
	collectStyles,
	resetStyles,
	snapshotCounter,
	restoreCounter,
} from './style.ts'

export type {
	StyleProperties,
	StyleObject,
	FontFace,
	GlobalStylesOptions,
} from './style.ts'