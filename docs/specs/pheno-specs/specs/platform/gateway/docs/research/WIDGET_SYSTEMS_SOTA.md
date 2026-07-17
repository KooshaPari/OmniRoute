# State of the Art Research - Widget Systems & Component Integration

**Project:** Portalis - Phenotype Ecosystem API Gateway
**Date:** 2026-04-05
**Status:** Research Complete
**Version:** 1.0

---

## Executive Summary

This document provides comprehensive research on widget systems, component architectures, and integration approaches for building extensible portal platforms. The analysis covers plugin architectures, component registration/discovery mechanisms, and sandboxed widget approaches including iframe, Shadow DOM, and Web Components.

### Research Objectives

1. Analyze plugin architecture patterns for extensible systems
2. Compare component registration and discovery mechanisms
3. Evaluate sandboxed widget approaches (iframe, Shadow DOM, Web Components)
4. Research widget communication patterns
5. Provide evidence-based recommendations for Portalis widget integration

### Key Findings

- Web Components provide the best balance of encapsulation and interoperability
- Plugin registries require version management and dependency resolution
- Shadow DOM enables true style and DOM encapsulation without iframe overhead
- Module Federation enables runtime sharing of components
- Widget sandboxes must balance security with communication flexibility
- Component discovery patterns impact portal scalability significantly

---

## Section 1: Plugin Architecture Patterns

### 1.1 Plugin System Fundamentals

Plugin architectures enable extensibility by allowing third-party code to integrate with a host application through well-defined interfaces.

#### 1.1.1 Plugin Architecture Types

| Architecture Type | Description | Examples | Best For |
|-------------------|-------------|----------|----------|
| **Hook-Based** | Plugins register callbacks at lifecycle hooks | WordPress, Kong | Event-driven systems |
| **Service-Based** | Plugins expose services consumed by host | Eclipse, VS Code | IDE-like platforms |
| **Component-Based** | Plugins provide UI components | Backstage, Grafana | Dashboard/portal systems |
| **Middleware-Based** | Plugins intercept and transform requests | Express.js, Redux | API/data processing |
| **Script-Based** | Plugins are loaded as scripts | jQuery plugins | Simple extensions |

#### 1.1.2 Plugin System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Plugin System Architecture                           │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        Host Application                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │
│  │  │   Core      │  │   Plugin    │  │   Plugin    │  │   Service   │ │  │
│  │  │   Engine    │──│   Manager   │──│   Registry  │──│   Locator   │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                           ┌────────┴────────┐                               │
│                           ▼                 ▼                               │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │         Plugin A                 │  │         Plugin B                 │  │
│  │  ┌─────────────┐ ┌─────────────┐ │  │  ┌─────────────┐ ┌─────────────┐ │  │
│  │  │  Manifest   │ │   Code      │ │  │  │  Manifest   │ │   Code      │ │  │
│  │  │  (metadata) │ │  (logic)    │ │  │  │  (metadata) │ │  (logic)    │ │  │
│  │  └─────────────┘ └─────────────┘ │  │  └─────────────┘ └─────────────┘ │  │
│  └──────────────────────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Plugin Lifecycle Management

#### 1.2.1 Plugin Lifecycle States

```
                    ┌─────────────┐
                    │  Discovered │
                    └──────┬──────┘
                           │ parse manifest
                           ▼
                    ┌─────────────┐
           ┌───────│   Loaded    │───────┐
           │       └──────┬──────┘       │
           │              │ resolve deps  │
           │              ▼               │
           │       ┌─────────────┐       │
    unload │       │  Resolved   │       │ load error
           │       └──────┬──────┘       │
           │              │ instantiate   │
           │              ▼               │
           │       ┌─────────────┐       │
           └──────▶│  Activated  │───────┘
                   └──────┬──────┘
                          │ error
                          ▼
                   ┌─────────────┐
                   │    Error    │
                   └─────────────┘
```

#### 1.2.2 Portalis Plugin Interface Design

```rust
/// Portalis Plugin Interface (Conceptual)
pub trait PortalisPlugin: Send + Sync {
    /// Plugin metadata
    fn metadata(&self) -> PluginMetadata;
    
    /// Called during plugin loading
    fn load(&mut self, context: &PluginContext) -> Result<(), PluginError>;
    
    /// Called when plugin is activated
    fn activate(&mut self) -> Result<(), PluginError>;
    
    /// Called when plugin is deactivated
    fn deactivate(&mut self) -> Result<(), PluginError>;
    
    /// Called during plugin unloading
    fn unload(&mut self) -> Result<(), PluginError>;
    
    /// Get plugin-provided routes
    fn routes(&self) -> Vec<PluginRoute>;
    
    /// Get plugin-provided middleware
    fn middleware(&self) -> Vec<Box<dyn Middleware>>;
}

pub struct PluginMetadata {
    pub name: String,
    pub version: Version,
    pub author: String,
    pub description: String,
    pub dependencies: Vec<Dependency>,
    pub apis: Vec<String>, // Required Portalis APIs
}
```

### 1.3 Plugin Registration Patterns

#### 1.3.1 Static Registration

Plugins are registered at build-time or configuration-time.

```yaml
# Portalis Static Plugin Configuration
plugins:
  - name: rate-limit-plugin
    source: 
      type: builtin
    config:
      algorithm: token_bucket
      
  - name: jwt-auth-plugin
    source:
      type: registry
      url: https://registry.portalis.io/plugins/jwt-auth@1.2.3
    config:
      jwks_url: https://auth.example.com/.well-known/jwks.json
      
  - name: custom-transform
    source:
      type: filesystem
      path: /etc/portalis/plugins/custom-transform.wasm
    config:
      transform_rules:
        - path: /api/users
          operation: add_header
```

#### 1.3.2 Dynamic Registration

Plugins are discovered and loaded at runtime.

```rust
// Dynamic plugin discovery
pub struct PluginRegistry {
    plugins: DashMap<String, Box<dyn PortalisPlugin>>,
    loaders: Vec<Box<dyn PluginLoader>>,
}

impl PluginRegistry {
    pub async fn discover(&self) -> Result<Vec<PluginMetadata>, DiscoveryError> {
        let mut discovered = Vec::new();
        
        for loader in &self.loaders {
            let plugins = loader.discover().await?;
            discovered.extend(plugins);
        }
        
        Ok(discovered)
    }
    
    pub async fn load(&self, plugin_id: &str) -> Result<(), LoadError> {
        // Resolve dependencies
        let metadata = self.resolve_metadata(plugin_id)?;
        self.resolve_dependencies(&metadata.dependencies).await?;
        
        // Load plugin code
        let loader = self.find_loader(plugin_id)?;
        let plugin = loader.load(plugin_id).await?;
        
        // Initialize and register
        plugin.activate()?;
        self.plugins.insert(plugin_id.to_string(), plugin);
        
        Ok(())
    }
}
```

### 1.4 Plugin Dependency Management

#### 1.4.1 Dependency Resolution Strategies

| Strategy | Description | Pros | Cons |
|----------|-------------|------|------|
| **Version Lock** | Exact version matching | Deterministic | Rigid |
| **Semver Range** | Compatible version ranges | Flexible | Potential conflicts |
| **Isolation** | Each plugin gets own copy | No conflicts | Memory overhead |
| **Shared** | Common dependencies shared | Efficient | Dependency hell |

#### 1.4.2 Portalis Plugin Dependency Model

```yaml
# Plugin manifest (portal.toml)
[package]
name = "jwt-auth-plugin"
version = "1.2.3"
author = "Portalis Team"
api_version = "2.0"  # Portalis API version

[dependencies]
# Other plugins this plugin depends on
plugins = [
  { name = "rate-limit-plugin", version = ">=1.0.0, <2.0.0" }
]

# External libraries (for WASM plugins)
[dependencies.wasm]
serde = "1.0"
jsonwebtoken = "9.0"

# Required Portalis capabilities
[capabilities]
required = ["http", "jwt", "cache"]
optional = ["redis", "metrics"]
```

---

## Section 2: Component Systems

### 2.1 Component Architecture Patterns

#### 2.1.1 Component System Comparison

| System | Encapsulation | Interop | Framework | Learning Curve |
|--------|--------------|---------|-----------|----------------|
| **Web Components** | Excellent | Universal | Native | Medium |
| **React Components** | CSS issues | React only | React | Low |
| **Vue Components** | Scoped CSS | Vue only | Vue | Low |
| **Angular Components** | Emulated | Angular only | Angular | High |
| **Svelte Components** | Scoped CSS | Svelte only | Svelte | Low |

#### 2.1.2 Component Registration Patterns

**Global Registry Pattern**
```javascript
// Global component registry
window.PortalComponents = {
  registry: new Map(),
  
  register(name, component) {
    if (this.registry.has(name)) {
      console.warn(`Component ${name} already registered`);
    }
    this.registry.set(name, component);
  },
  
  get(name) {
    return this.registry.get(name);
  },
  
  list() {
    return Array.from(this.registry.keys());
  }
};

// Register a component
PortalComponents.register('user-profile', UserProfileWidget);

// Use a component
const UserProfile = PortalComponents.get('user-profile');
```

**Module Registry Pattern**
```typescript
// Scoped component registry
class ComponentRegistry {
  private components = new Map<string, ComponentDefinition>();
  private metadata = new Map<string, ComponentMetadata>();
  
  register(definition: ComponentDefinition): void {
    const { name, component, metadata } = definition;
    
    // Validate component
    this.validateComponent(component);
    
    // Store component
    this.components.set(name, component);
    this.metadata.set(name, {
      ...metadata,
      registeredAt: new Date(),
      version: metadata.version || '1.0.0'
    });
    
    // Emit registration event
    this.emit('component:registered', { name, metadata });
  }
  
  resolve(name: string, version?: string): Component {
    const component = this.components.get(name);
    if (!component) {
      throw new ComponentNotFoundError(name);
    }
    
    if (version) {
      const meta = this.metadata.get(name);
      if (!this.satisfiesVersion(meta.version, version)) {
        throw new VersionMismatchError(name, meta.version, version);
      }
    }
    
    return component;
  }
  
  query(filter: ComponentFilter): ComponentDefinition[] {
    return Array.from(this.components.entries())
      .filter(([name, _]) => this.matchesFilter(name, filter))
      .map(([name, component]) => ({
        name,
        component,
        metadata: this.metadata.get(name)!
      }));
  }
}
```

### 2.2 Component Discovery Mechanisms

#### 2.2.1 Discovery Patterns

| Pattern | Mechanism | Latency | Scalability | Use Case |
|---------|-----------|---------|-------------|----------|
| **Static Import** | Build-time import | None | Limited | Small applications |
| **Dynamic Import** | Runtime `import()` | Low | Good | Route-based loading |
| **Registry Query** | HTTP API call | Medium | Excellent | Large catalogs |
| **Event-Based** | Pub/Sub discovery | Low | Good | Distributed systems |
| **Service Mesh** | Sidecar proxy | Low | Excellent | Microservices |

#### 2.2.2 Portalis Component Discovery Service

```rust
/// Component Discovery Service
pub struct ComponentDiscoveryService {
    registry: Arc<dyn ComponentRegistry>,
    cache: Cache<String, Vec<ComponentMetadata>>,
    sources: Vec<Box<dyn ComponentSource>>,
}

#[async_trait]
impl ComponentDiscovery for ComponentDiscoveryService {
    async fn discover(&self, query: DiscoveryQuery) -> Result<Vec<ComponentMetadata>, DiscoveryError> {
        let cache_key = self.build_cache_key(&query);
        
        // Check cache first
        if let Some(cached) = self.cache.get(&cache_key).await {
            return Ok(cached);
        }
        
        // Query all sources in parallel
        let futures = self.sources.iter()
            .map(|source| source.query(&query));
        
        let results = join_all(futures).await;
        
        // Merge and deduplicate
        let components = self.merge_results(results)?;
        
        // Filter by query criteria
        let filtered = components.into_iter()
            .filter(|c| self.matches_query(c, &query))
            .collect::<Vec<_>>();
        
        // Cache results
        self.cache.set(cache_key, filtered.clone(), Duration::from_secs(300)).await;
        
        Ok(filtered)
    }
    
    async fn resolve(&self, component_id: &str, version_constraint: &str) -> Result<Component, ResolveError> {
        // Query registry for specific version
        let candidates = self.registry.versions(component_id).await?;
        
        // Select best matching version
        let version = candidates.iter()
            .filter(|v| satisfies_constraint(v, version_constraint))
            .max_by(|a, b| compare_versions(a, b))
            .ok_or(ResolveError::NoMatchingVersion)?;
        
        // Fetch component
        self.registry.fetch(component_id, version).await
    }
}
```

### 2.3 Component Versioning

#### 2.3.1 Semantic Versioning for Components

```yaml
# Component versioning strategy
versioning:
  strategy: semver
  
  # Breaking changes require major version bump
  breaking_changes:
    - Remove prop
    - Change prop type
    - Remove exported function
    - Change event signature
    
  # New features require minor version bump
  features:
    - Add optional prop
    - Add new method
    - Add new event
    
  # Bug fixes require patch version bump
  fixes:
    - Fix styling
    - Fix event handling
    - Fix internal logic

# Version compatibility matrix
compatibility:
  "^1.0.0":
    supported: ["1.0.0", "1.1.0", "1.2.0"]
    deprecated: ["1.0.0"]
    
  "^2.0.0":
    supported: ["2.0.0", "2.1.0"]
    breaking_changes_from_v1:
      - "prop 'userId' renamed to 'user_id'"
      - "event 'onClick' signature changed"
```

---

## Section 3: Sandboxed Widget Approaches

### 3.1 Sandboxing Comparison

| Approach | Isolation Level | Performance | Communication | Security |
|----------|----------------|-------------|---------------|----------|
| **iframe** | Complete | Slow | postMessage | Excellent |
| **Shadow DOM** | DOM/CSS only | Fast | Direct | Good |
| **Web Worker** | JS execution | Fast | Message passing | Good |
| **WASM Sandbox** | Memory | Fast | Host bindings | Excellent |
| **SES (Secure ECMAScript)** | Object capability | Native | Direct | Very Good |

### 3.2 iframe Sandboxing

#### 3.2.1 iframe Security Configuration

```html
<iframe
  id="widget-container"
  src="https://widget.third-party.com/widget.html"
  
  <!-- Security attributes -->
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
  allow="camera; microphone; geolocation"
  referrerpolicy="no-referrer"
  csp="default-src 'self'; script-src 'self' 'unsafe-inline'"
  
  <!-- Performance attributes -->
  loading="lazy"
  importance="low"
  
  <!-- Styling -->
  style="border: none; width: 100%; height: 100%;"
></iframe>
```

#### 3.2.2 iframe Sandboxing Options

| Sandbox Attribute | Effect | Risk Level |
|-------------------|--------|------------|
| `allow-scripts` | JavaScript execution | Medium |
| `allow-same-origin` | Same-origin access | High |
| `allow-popups` | Open popups | Low |
| `allow-forms` | Form submission | Low |
| `allow-popups-to-escape-sandbox` | Unsandboxed popups | Medium |
| `allow-modals` | Show modals | Low |
| `allow-orientation-lock` | Lock orientation | Low |
| `allow-pointer-lock` | Pointer lock API | Low |
| `allow-presentation` | Presentation API | Low |
| `allow-top-navigation` | Navigate top window | **Critical** |

#### 3.2.3 iframe Communication Protocol

```javascript
// Host (Portalis Portal) - Sending messages to iframe
class IframeWidgetHost {
  constructor(iframe, widgetConfig) {
    this.iframe = iframe;
    this.config = widgetConfig;
    this.messageHandlers = new Map();
    this.setupMessageListener();
  }
  
  send(message) {
    // Always specify target origin explicitly
    this.iframe.contentWindow.postMessage(
      {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        source: 'portalis-host',
        type: message.type,
        payload: message.payload
      },
      this.config.allowedOrigin // Never use '*'
    );
  }
  
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      // 1. Verify origin
      if (event.origin !== this.config.allowedOrigin) {
        console.warn('Rejected message from untrusted origin:', event.origin);
        return;
      }
      
      // 2. Verify structure
      if (!event.data.type || !event.data.source) {
        return;
      }
      
      // 3. Handle message
      const handler = this.messageHandlers.get(event.data.type);
      if (handler) {
        handler(event.data.payload, event);
      }
    });
  }
  
  // API methods
  authenticate(token) {
    this.send({
      type: 'auth:token',
      payload: { token }
    });
  }
  
  updateContext(context) {
    this.send({
      type: 'context:update',
      payload: context
    });
  }
}

// Widget (inside iframe) - Receiving messages
class IframeWidgetClient {
  constructor() {
    this.parentOrigin = null;
    this.messageQueue = [];
    this.ready = false;
  }
  
  init(expectedOrigin) {
    this.parentOrigin = expectedOrigin;
    
    window.addEventListener('message', (event) => {
      // Verify message from expected parent
      if (event.origin !== this.parentOrigin) {
        return;
      }
      
      this.handleMessage(event.data);
    });
    
    // Signal ready
    this.sendToParent({
      type: 'widget:ready',
      payload: { version: '1.0.0' }
    });
  }
  
  sendToParent(message) {
    if (!this.parentOrigin) {
      this.messageQueue.push(message);
      return;
    }
    
    window.parent.postMessage(message, this.parentOrigin);
  }
}
```

### 3.3 Shadow DOM Sandboxing

#### 3.3.1 Shadow DOM Encapsulation

```javascript
// Custom Element with Shadow DOM
class PortalWidget extends HTMLElement {
  constructor() {
    super();
    
    // Create shadow root (closed for true encapsulation)
    this.shadow = this.attachShadow({ mode: 'closed' });
    
    // Build encapsulated DOM
    this.render();
  }
  
  render() {
    // Styles are completely isolated
    const styles = document.createElement('style');
    styles.textContent = `
      :host {
        display: block;
        padding: 16px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
      }
      
      .widget-header {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 12px;
      }
      
      /* These styles don't leak to parent document */
      h2 { color: #333; }
      button { background: #0066cc; }
    `;
    
    const template = document.createElement('template');
    template.innerHTML = `
      <div class="widget-container">
        <div class="widget-header">
          <slot name="header">Default Header</slot>
        </div>
        <div class="widget-content">
          <slot></slot>
        </div>
        <div class="widget-footer">
          <button class="action-btn">Action</button>
        </div>
      </div>
    `;
    
    this.shadow.appendChild(styles);
    this.shadow.appendChild(template.content.cloneNode(true));
    
    // Bind events
    this.shadow.querySelector('.action-btn')
      .addEventListener('click', () => this.handleAction());
  }
  
  handleAction() {
    // Dispatch event that crosses shadow boundary
    this.dispatchEvent(new CustomEvent('widget:action', {
      bubbles: true,
      composed: true, // Cross shadow boundary
      detail: { timestamp: Date.now() }
    }));
  }
}

customElements.define('portal-widget', PortalWidget);
```

#### 3.3.2 Shadow DOM vs iframe Comparison

| Aspect | Shadow DOM | iframe |
|--------|-----------|----------|
| **DOM Encapsulation** | Yes (full) | Yes (complete) |
| **CSS Encapsulation** | Yes (full) | Yes (complete) |
| **JS Encapsulation** | No (shared context) | Yes (separate context) |
| **Performance** | Excellent | Good (overhead) |
| **Communication** | Direct DOM/events | postMessage only |
| **Sizing** | Automatic | Manual (requires resizing logic) |
| **Security** | Medium | High (same-origin policy) |
| **Third-party code** | Risky | Safer |

### 3.4 Web Components as Widgets

#### 3.4.1 Web Component Widget Architecture

```typescript
// Portalis Widget Base Class
abstract class PortalisWidget extends HTMLElement {
  protected config: WidgetConfig;
  protected shadow: ShadowRoot;
  protected state: WidgetState;
  
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.state = { loading: true, error: null, data: null };
  }
  
  // Lifecycle callbacks
  connectedCallback() {
    this.parseAttributes();
    this.renderLoading();
    this.loadData();
    this.setupEventListeners();
  }
  
  disconnectedCallback() {
    this.cleanup();
  }
  
  attributeChangedCallback(name: string, oldVal: string, newVal: string) {
    if (oldVal !== newVal) {
      this.onAttributeChange(name, newVal);
    }
  }
  
  // Abstract methods for subclasses
  abstract render(): void;
  abstract loadData(): Promise<void>;
  abstract onAttributeChange(name: string, value: string): void;
  
  // Common functionality
  protected async fetchData(endpoint: string): Promise<any> {
    const response = await fetch(`${this.config.apiBaseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'X-Widget-ID': this.config.widgetId
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  protected emit(eventName: string, detail: any): void {
    this.dispatchEvent(new CustomEvent(`portalis:${eventName}`, {
      bubbles: true,
      composed: true,
      detail
    }));
  }
  
  // Rendering helpers
  protected renderLoading(): void {
    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .loading { text-align: center; padding: 20px; }
      </style>
      <div class="loading">Loading widget...</div>
    `;
  }
  
  protected renderError(error: Error): void {
    this.shadow.innerHTML = `
      <style>
        :host { display: block; }
        .error { color: #d32f2f; padding: 20px; }
      </style>
      <div class="error">Error: ${error.message}</div>
    `;
  }
}
```

#### 3.4.2 Web Component Communication Patterns

```typescript
// Event-based communication between widgets
class EventBus extends HTMLElement {
  private subscribers = new Map<string, Set<EventListener>>();
  
  subscribe(eventType: string, callback: EventListener): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(callback);
    
    return () => this.subscribers.get(eventType)?.delete(callback);
  }
  
  publish(eventType: string, detail: any): void {
    const event = new CustomEvent(`bus:${eventType}`, {
      bubbles: true,
      composed: true,
      detail
    });
    
    this.dispatchEvent(event);
    
    // Also notify direct subscribers
    this.subscribers.get(eventType)?.forEach(cb => cb(event));
  }
}

// Widget using event bus
class UserWidget extends PortalisWidget {
  private eventBus: EventBus;
  
  connectedCallback() {
    super.connectedCallback();
    
    // Subscribe to global events
    this.eventBus = document.querySelector('portal-event-bus')!;
    this.eventBus.subscribe('user:selected', (e: Event) => {
      const customEvent = e as CustomEvent;
      this.loadUser(customEvent.detail.userId);
    });
  }
  
  onUserClick(userId: string) {
    // Publish event for other widgets
    this.eventBus.publish('user:selected', { userId });
  }
}
```

---

## Section 4: Widget Integration Patterns

### 4.1 Integration Approaches Comparison

| Approach | Implementation | Best For | Trade-offs |
|----------|-----------------|----------|------------|
| **Iframe Embed** | `<iframe src="...">` | Third-party widgets | Isolation overhead |
| **Script Tag** | `<script src="...">` | Self-hosted widgets | Namespace pollution |
| **Web Component** | `<custom-element>` | Modern portals | Browser support |
| **Module Import** | `import('/widget.js')` | ES modules | Dynamic loading complexity |
| **WASM Module** | `WebAssembly.instantiate()` | High-performance | Development complexity |

### 4.2 Widget Loading Strategies

#### 4.2.1 Lazy Loading Implementation

```typescript
// Widget lazy loader
class WidgetLoader {
  private cache = new Map<string, Promise<any>>();
  
  async loadWidget(url: string, config: WidgetConfig): Promise<HTMLElement> {
    // Check cache
    if (this.cache.has(url)) {
      await this.cache.get(url);
    } else {
      const loadPromise = this.loadScript(url);
      this.cache.set(url, loadPromise);
      await loadPromise;
    }
    
    // Create widget element
    const widget = document.createElement(config.tagName);
    
    // Apply configuration
    Object.entries(config.attributes).forEach(([key, value]) => {
      widget.setAttribute(key, value);
    });
    
    return widget;
  }
  
  private loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = url;
      script.type = 'module';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${url}`));
      
      document.head.appendChild(script);
    });
  }
  
  // Intersection Observer for viewport-based loading
  setupLazyLoad(container: HTMLElement, widgetUrl: string, config: WidgetConfig) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadWidget(widgetUrl, config).then(widget => {
            container.appendChild(widget);
          });
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '100px' });
    
    observer.observe(container);
  }
}
```

#### 4.2.2 Preloading Strategies

```html
<!-- Preload critical widgets -->
<link rel="preload" href="/widgets/header.js" as="script">
<link rel="preload" href="/widgets/navigation.js" as="script">

<!-- Prefetch likely-needed widgets -->
<link rel="prefetch" href="/widgets/analytics.js">
<link rel="prefetch" href="/widgets/notifications.js">

<!-- Modulepreload for ES modules -->
<link rel="modulepreload" href="/widgets/core-utils.js">
```

### 4.3 Widget Configuration Patterns

#### 4.3.1 Declarative Configuration

```html
<!-- HTML-based widget configuration -->
<portal-widget
  type="analytics-chart"
  data-source="/api/metrics"
  refresh-interval="30000"
  theme="dark"
  permissions="read:analytics"
>
  <widget-param name="chartType" value="line"></widget-param>
  <widget-param name="timeRange" value="7d"></widget-param>
</portal-widget>
```

#### 4.3.2 Programmatic Configuration

```typescript
// JavaScript-based widget configuration
interface WidgetConfig {
  id: string;
  type: string;
  source: WidgetSource;
  permissions: string[];
  props: Record<string, any>;
  lifecycle: LifecycleHooks;
}

const widgetConfig: WidgetConfig = {
  id: 'user-profile-001',
  type: 'user-profile',
  source: {
    type: 'registry',
    url: 'https://registry.portalis.io/widgets/user-profile@2.1.0',
    integrity: 'sha256-abc123...'
  },
  permissions: ['read:user', 'read:profile'],
  props: {
    userId: 'user_123',
    editable: true,
    theme: 'light'
  },
  lifecycle: {
    onLoad: () => console.log('Widget loaded'),
    onError: (err) => console.error('Widget error:', err),
    onDestroy: () => console.log('Widget destroyed')
  }
};

// Initialize widget
widgetManager.mount(widgetConfig, document.getElementById('container')!);
```

---

## Section 5: Widget Security Patterns

### 5.1 Content Security Policy for Widgets

```http
Content-Security-Policy:
  default-src 'self';
  
  # Widget scripts from trusted sources
  script-src 'self' 
    'nonce-{random}' 
    https://cdn.portalis.io 
    https://widgets.trusted-partner.com;
  
  # Widget styles
  style-src 'self' 
    'unsafe-inline'  # Required for some widget libraries
    https://fonts.googleapis.com;
  
  # Widget connections
  connect-src 'self' 
    https://api.portalis.io 
    https://analytics.collector.com;
  
  # Widget frames
  frame-src https://widgets.third-party.com;
  
  # Widget images
  img-src 'self' data: https:;
  
  # No eval
  script-src-attr 'none';
```

### 5.2 Widget Permission Model

```typescript
// Capability-based widget permissions
interface WidgetCapabilities {
  // Network
  fetch: {
    allowed: boolean;
    allowedOrigins: string[];
    maxRequestsPerMinute: number;
  };
  
  // Storage
  storage: {
    localStorage: boolean;
    sessionStorage: boolean;
    indexedDB: boolean;
    quotaMB: number;
  };
  
  // UI
  ui: {
    modal: boolean;
    notification: boolean;
    fullscreen: boolean;
  };
  
  // System
  system: {
    clipboard: boolean;
    geolocation: boolean;
    camera: boolean;
    microphone: boolean;
  };
}

// Permission grant based on widget trust level
function getCapabilities(trustLevel: TrustLevel): WidgetCapabilities {
  switch (trustLevel) {
    case 'internal':
      return { /* Full capabilities */ };
    case 'partner':
      return { /* Limited capabilities */ };
    case 'third-party':
      return { /* Restricted capabilities */ };
    case 'untrusted':
      return { /* Minimal capabilities */ };
  }
}
```

### 5.3 Widget Isolation Techniques

#### 5.3.1 Subresource Integrity

```html
<script 
  src="https://cdn.portalis.io/widgets/analytics.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykW6VHVQNl8e4n52Z9sC1Fv3c5f6v7g8h9i0j1k2l3m4n5"
  crossorigin="anonymous"
></script>
```

#### 5.3.2 Feature Policy

```html
<iframe 
  src="https://untrusted-widget.com"
  allow="camera 'none'; microphone 'none'; geolocation 'none'"
  sandbox="allow-scripts"
></iframe>
```

---

## Section 6: Real-World Widget Systems

### 6.1 Grafana Plugin System

Grafana uses a comprehensive plugin architecture:

| Feature | Implementation |
|---------|---------------|
| Plugin Types | Panel, Data Source, App |
| Loading | Dynamic import |
| Security | Code signing |
| Registry | Centralized + Self-hosted |
| Backend | Go plugins for data sources |

### 6.2 VS Code Extension Model

VS Code extensions demonstrate sophisticated sandboxing:

| Aspect | Implementation |
|--------|---------------|
| Process | Isolated extension host |
| API | Restricted extension API |
| Activation | Event-based |
| Marketplace | Centralized with reviews |

### 6.3 Backstage Plugin Architecture

Backstage plugins follow a specific pattern:

```typescript
// Backstage-style plugin for Portalis
export const UserProfilePlugin = createPlugin({
  id: 'user-profile',
  register({ router, catalog, apiHolder }) {
    // Register routes
    router.addRoute({
      path: '/user-profile',
      Component: UserProfilePage
    });
    
    // Register API
    apiHolder.register(userProfileApiRef, new UserProfileApi());
    
    // Register with catalog
    catalog.addComponent({
      name: 'UserProfileWidget',
      component: UserProfileWidget
    });
  }
});
```

---

## Section 7: Recommendations for Portalis

### 7.1 Widget System Architecture

Recommended architecture for Portalis widget integration:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Portalis Widget System                               │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      Widget Registry                                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  Manifest   │  │  Version    │  │  Security   │  │  Analytics  │  │  │
│  │  │  Store      │  │  Manager    │  │  Scanner    │  │  Collector  │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      Widget Loader                                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │
│  │  │  Sandbox    │  │  Dependency │  │  Lifecycle  │  │  Hot        │ │  │
│  │  │  Manager    │  │  Resolver   │  │  Manager    │  │  Reload     │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│           ┌────────────────────────┼────────────────────────┐                 │
│           ▼                        ▼                        ▼                 │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐          │
│  │   iframe     │         │   Shadow     │         │   Web        │          │
│  │   Widget     │         │   DOM Widget │         │   Component  │          │
│  └──────────────┘         └──────────────┘         └──────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Implementation Recommendations

| Priority | Feature | Approach | Rationale |
|----------|---------|----------|-----------|
| **P0** | Widget Registry | REST API + YAML config | Simple, effective |
| **P0** | Sandboxing | iframe for third-party, Shadow DOM for internal | Security first |
| **P1** | Web Component Support | Custom element registry | Standards-based |
| **P1** | Dynamic Loading | ES modules + import maps | Modern, efficient |
| **P2** | Hot Reload | WebSocket reload signal | Developer experience |
| **P2** | Plugin API | Hook-based middleware system | Extensibility |
| **P3** | WASM Support | wasmer-js for sandboxed code | Future-proofing |

### 7.3 Widget SDK Design

```typescript
// Portalis Widget SDK
import { createWidget, defineConfig } from '@portalis/widget-sdk';

export default createWidget({
  // Widget metadata
  name: 'analytics-dashboard',
  version: '1.0.0',
  
  // Configuration schema
  config: defineConfig({
    dataSource: {
      type: 'string',
      required: true,
      description: 'API endpoint for data'
    },
    refreshInterval: {
      type: 'number',
      default: 30000,
      description: 'Refresh interval in ms'
    }
  }),
  
  // Widget implementation
  async mount(container, config, context) {
    // Fetch data through Portalis proxy
    const data = await context.api.fetch(config.dataSource);
    
    // Render widget
    container.innerHTML = `
      <div class="analytics-widget">
        <h3>${data.title}</h3>
        <chart-component data='${JSON.stringify(data.chart)}'></chart-component>
      </div>
    `;
    
    // Set up refresh
    const interval = setInterval(async () => {
      const newData = await context.api.fetch(config.dataSource);
      this.update(container, newData);
    }, config.refreshInterval);
    
    // Return cleanup function
    return () => clearInterval(interval);
  },
  
  // Event handlers
  onEvent(event) {
    if (event.type === 'user:login') {
      this.refresh();
    }
  }
});
```

---

## Section 8: References

### 8.1 Web Components References

| Reference | URL | Description |
|-----------|-----|-------------|
| Web Components MDN | https://developer.mozilla.org/en-US/docs/Web/API/Web_components | Official documentation |
| Custom Elements Spec | https://html.spec.whatwg.org/multipage/custom-elements.html | HTML spec |
| Shadow DOM Spec | https://dom.spec.whatwg.org/#shadow-trees | DOM spec |
| Lit Library | https://lit.dev/ | Modern web components library |
| Stencil | https://stenciljs.com/ | Web components compiler |

### 8.2 Plugin Architecture References

| Reference | URL | Description |
|-----------|-----|-------------|
| Backstage Plugins | https://backstage.io/docs/plugins/create-a-plugin | Backstage plugin docs |
| Grafana Plugins | https://grafana.com/docs/grafana/latest/developers/plugins/ | Grafana plugin guide |
| Kong Plugins | https://docs.konghq.com/gateway/latest/plugin-development/ | Kong plugin development |
| VS Code Extensions | https://code.visualstudio.com/api | VS Code extension API |

### 8.3 Security References

| Reference | URL | Description |
|-----------|-----|-------------|
| CSP Reference | https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP | Content Security Policy |
| iframe Sandbox | https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox | iframe sandboxing |
| Trusted Types | https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API | XSS prevention |
| Subresource Integrity | https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity | SRI documentation |

### 8.4 Module Federation References

| Reference | URL | Description |
|-----------|-----|-------------|
| Module Federation | https://module-federation.io/ | Official documentation |
| Webpack 5 MF | https://webpack.js.org/concepts/module-federation/ | Webpack implementation |
| Native Federation | https://www.npmjs.com/package/@angular-architects/native-federation | Framework-agnostic |

---

## Appendix A: Widget Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Widget Lifecycle                                   │
│                                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
│  │  Load   │───▶│ Parse   │───▶│ Validate│───▶│ Resolve │───▶│ Initialize│   │
│  │ Script  │    │ Config  │    │  CSP    │    │  Deps   │    │   State   │   │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └────┬────┘   │
│                                                                    │        │
│                                                                    ▼        │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │ Destroy │◀───│  Error  │◀───│  Update │◀───│ Render  │◀───│  Mount   │ │
│  │         │    │ Handler │    │  State  │    │   DOM   │    │          │ │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘ │
│       ▲                                                                     │
│       └────────────────────────────────────────────────────────────────────┘
│                                    Unmount
└─────────────────────────────────────────────────────────────────────────────┘
```

### Appendix B: Widget Communication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Widget Communication                                │
│                                                                              │
│    Widget A              Event Bus              Widget B                     │
│       │                      │                      │                        │
│       │    user:selected     │                      │                        │
│       │─────────────────────▶│                      │                        │
│       │                      │    user:selected   │                        │
│       │                      │─────────────────────▶│                        │
│       │                      │                      │                        │
│       │                      │◀─────────────────────│    data:request        │
│       │◀─────────────────────│    data:response    │                        │
│       │                      │◀─────────────────────│                        │
│       │                      │                      │                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quality Checklist

- [x] Minimum 400 lines of widget system analysis
- [x] Plugin architecture patterns documented
- [x] Component registration/discovery covered
- [x] Sandboxed approaches compared (iframe, Shadow DOM, Web Components)
- [x] Integration patterns documented
- [x] Security patterns included
- [x] Real-world examples referenced
- [x] References with URLs
- [x] Recommendations for Portalis

---

**Research Team:** Portalis Architecture Team
**Date:** 2026-04-05
**Next Review:** 2026-05-05
**Version:** 1.0
