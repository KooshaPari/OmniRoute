import assert from 'node:assert/strict'
import { createSiteMeta } from '../../.vitepress/site-meta.mjs'
Deno.test('createSiteMeta is a function', () => { assert.strictEqual(typeof createSiteMeta, 'function') })
Deno.test('createSiteMeta returns an object', () => { const m = createSiteMeta({ base:'/' }); assert.strictEqual(typeof m,'object') })
