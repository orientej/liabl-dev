// @liabl/ui — the surface genuinely shared between the operator/participant
// app and the marketing site.
//
// Deliberately small. These pieces earned their way in by being reached
// for from both apps: the brand mark, the top navigation, the icon set,
// the stylesheet whose component classes both use, and the Tailwind theme
// that defines the palette. Anything used by only one app stays in that
// app — a shared package that accumulates single-consumer code is how you
// end up with a component library that fits neither side.
export { default as Logo } from './Logo'
export { default as PageNav } from './PageNav'
export * from './icons'
