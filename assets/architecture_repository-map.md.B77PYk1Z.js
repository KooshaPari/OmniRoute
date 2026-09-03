import{B as e,Q as t,s as n,z as r}from"./chunks/framework.DaWAnZmO.js";var i=JSON.parse(`{"title":"Repository Map","description":"","frontmatter":{"title":"Repository Map"},"headers":[],"relativePath":"architecture/repository-map.md","filePath":"architecture/repository-map.md"}`),a={name:`architecture/repository-map.md`};function o(n,i,a,o,s,c){return t(),r(`div`,null,[...i[0]||=[e(`<h1 id="repository-map" tabindex="-1">Repository Map <a class="header-anchor" href="#repository-map" aria-label="Permalink to &quot;Repository Map&quot;">​</a></h1><p>High-level tour of the OmniRoute codebase. For exhaustive module-level docs, see <code>docs/architecture/CODEBASE_DOCUMENTATION.md</code>.</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>OmniRoute/</span></span>
<span class="line"><span>├── src/                    # TypeScript source</span></span>
<span class="line"><span>│   ├── router/             # Routing decision logic</span></span>
<span class="line"><span>│   ├── providers/          # Provider plugin loader</span></span>
<span class="line"><span>│   ├── server/             # HTTP server (OpenAI-compatible)</span></span>
<span class="line"><span>│   ├── db/                 # SQLite store</span></span>
<span class="line"><span>│   ├── auth/               # API key + scope check</span></span>
<span class="line"><span>│   └── governance/         # Audit chain, governance checks</span></span>
<span class="line"><span>├── open-sse/               # OpenAI SSE streaming shim</span></span>
<span class="line"><span>├── tests/                  # Bun test runner</span></span>
<span class="line"><span>├── docs/                   # Existing docs (preserved as-is)</span></span>
<span class="line"><span>├── docs-site/              # This VitePress site</span></span>
<span class="line"><span>├── deploy/                 # Docker / K8s / Caddy / systemd</span></span>
<span class="line"><span>├── plans/                  # RFCs, recovery specs, WBS plans</span></span>
<span class="line"><span>└── demo/                   # GUI/visual demo program</span></span></code></pre></div>`,3)]])}var s=n(a,[[`render`,o]]);export{i as __pageData,s as default};