# @omniroute/local-models

Optional local inference companion for OmniRoute. It owns the Transformers.js and
LLMLingua dependency closure, so a normal OmniRoute installation remains free of
local-model runtime dependencies.

Install this package only when local embeddings or LLMLingua semantic compression
are required:

```sh
npm install @omniroute/local-models
```

For a global OmniRoute installation, install it into the same global npm prefix:

```sh
npm install -g @omniroute/local-models
```

When absent, OmniRoute's local-model paths fail open: embeddings return their
normal structured load failure and LLMLingua returns the original text unchanged.
