import assert from 'node:assert/strict'
import { createSiteMeta } from '../../.vitepress/site-meta.mjs'
Deno.test('createSiteMeta is a function', () => { assert.strictEqual(typeof createSiteMeta, 'function') })
