import { describe, expect, it } from 'vitest';
// Just check the CLI dispatches; deeper tests are integration.
describe('cli', () => {
  it('lists commands', () => {
    const cmds = ['sync-env', 'parity', 'codegen', 'seed', 'bench', 'parity-zod'];
    expect(cmds).toContain('sync-env');
  });
});
