---
title: Provider Plugin Manifest
---

# Provider Plugin Manifest

Declare a provider once. Reuse across every OpenAI-compatible client.

```ts
// providers/my-plugin/index.ts
import type { ProviderManifest } from '@kooshapari/omniroute'

export default {
  id: 'my-plugin',
  baseURL: 'https://my-plugin.example.com/v1',
  models: ['my-fast', 'my-smart'],
  auth: { header: 'Authorization', scheme: 'Bearer' },
  failover: { priority: 10, onQuota: true },
} satisfies ProviderManifest
```

Load it:

```sh
omniroute start --provider-plugin ./providers/my-plugin
```

The manifest is type-checked at startup. A malformed manifest halts the server before traffic.
