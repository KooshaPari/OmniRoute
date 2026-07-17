// Vitest runs TypeScript modules without the Svelte compiler. Model the value
// semantics used by the i18n module's primitive `$state` rune for Node tests.
Reflect.defineProperty(globalThis, '$state', {
  configurable: true,
  value: <T>(initial: T): T => initial,
});
