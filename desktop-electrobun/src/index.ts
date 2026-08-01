/**
 * Packaged Electrobun entrypoint.
 *
 * The native launcher resolves the flat bundle as `bun/index.js`. Keep the
 * application implementation in `main.ts` and import it once so the emitted
 * artifact has the launcher-compatible name without a second runtime.
 */
import "./main";
