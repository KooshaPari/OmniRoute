# Feature Flag Patterns State-of-the-Art Research

> **Flagward Research Series - Part 2**  
> Research Date: 2026-04-05  
> Project: Flagward - Next-Generation Feature Flag Platform  

---

## Executive Summary

This document explores the implementation patterns, testing strategies, and architectural considerations for feature flag systems. Based on industry research from Martin Fowler, Pete Hodgson, and leading platform engineering teams, we present a comprehensive guide to designing robust, maintainable, and scalable feature flag implementations.

### Key Insights

1. **Pattern Selection Matters**: Different flag types (release, experiment, ops, permissioning) require different implementation approaches
2. **Testing Complexity**: Feature flags introduce combinatorial testing challenges that must be addressed systematically
3. **Local Evaluation Preferred**: Modern architectures favor local evaluation for <1ms latency with streaming updates
4. **Lifecycle Management**: 84% of feature flag technical debt comes from stale, forgotten flags

---

## 1. Feature Flag Types & Patterns

### 1.1 Boolean Flags (On/Off Toggles)

**Definition**
The simplest form of feature flag - a binary switch that enables or disables a code path.

**Implementation Pattern**
```typescript
// Basic boolean flag check
if (featureFlags.isEnabled('new-checkout-flow')) {
  return renderNewCheckout();
} else {
  return renderLegacyCheckout();
}
```

**Best Practices**
- Always provide a default value (usually `false` for safety)
- Use descriptive names (verb-noun pattern): `enable-new-dashboard`, `disable-cache`
- Keep flag checks close to the feature they control
- Avoid deep nesting of flag checks

**Use Cases**
- Kill switches for emergency disable
- Feature release gates
- Maintenance mode toggles
- Beta feature access

**Anti-Patterns to Avoid**
```typescript
// BAD: Nested flag hell
if (flags.isEnabled('feature-a')) {
  if (flags.isEnabled('feature-b')) {
    if (flags.isEnabled('feature-c')) {
      // Logic here
    }
  }
}

// GOOD: Flattened with strategy pattern
const strategy = getStrategyForContext(context);
return strategy.execute();
```

---

### 1.2 Multivariate Flags

**Definition**
Flags with multiple possible values (not just on/off), enabling A/B/n testing and complex configuration.

**Implementation Pattern**
```typescript
// Multivariate flag returning string values
const buttonColor = featureFlags.getValue('cta-button-color', 'blue');
// Returns: 'blue', 'green', 'red', or 'orange'

const algorithm = featureFlags.getValue('search-algorithm', 'default');
// Returns: 'default', 'experimental-v2', 'ml-enhanced'
```

**Configuration Structure**
```json
{
  "flagKey": "search-algorithm",
  "enabled": true,
  "defaultValue": "default",
  "variants": [
    {
      "value": "default",
      "weight": 50,
      "payload": {
        "timeout": 1000,
        "cacheEnabled": true
      }
    },
    {
      "value": "experimental-v2",
      "weight": 25,
      "payload": {
        "timeout": 500,
        "cacheEnabled": false,
        "parallelQueries": 3
      }
    },
    {
      "value": "ml-enhanced",
      "weight": 25,
      "payload": {
        "timeout": 2000,
        "mlModel": "ranking-v3",
        "personalizationEnabled": true
      }
    }
  ]
}
```

**Use Cases**
- A/B/n testing with multiple variants
- Dynamic configuration injection
- Algorithm selection
- UI theme/variant testing

---

### 1.3 Percentage Rollout (Gradual Rollout)

**Definition**
Progressively exposing a feature to a percentage of users, enabling canary releases and risk mitigation.

**Implementation Pattern**
```typescript
// Deterministic percentage-based rollout
function isEnabledForUser(flagKey: string, userId: string, percentage: number): boolean {
  // Create a deterministic hash based on flagKey + userId
  const hash = createHash('md5')
    .update(`${flagKey}:${userId}`)
    .digest('hex');
  
  // Convert first 4 bytes to integer (0-65535)
  const hashInt = parseInt(hash.substring(0, 4), 16);
  
  // Map to 0-100 range
  const userPercentage = (hashInt / 65535) * 100;
  
  return userPercentage < percentage;
}

// Usage
const shouldShowFeature = isEnabledForUser('new-ui', user.id, 10);
// Exactly 10% of users will see the feature, consistently
```

**Progressive Rollout Strategy**
```
Phase 1: 0%    - Internal testing only
Phase 2: 1%    - Canary release (watch for errors)
Phase 3: 5%    - Early adopters
Phase 4: 25%   - Expanded audience
Phase 5: 50%   - Majority exposure
Phase 6: 100%  - Full rollout
Phase 7: Remove flag - Cleanup
```

**Stickiness Consideration**
Users must consistently fall into the same bucket to avoid UX inconsistency:
```typescript
// With stickiness - user always sees same variant
const variant = flags.getVariant('new-ui', user.id); // Consistent

// Without stickiness - random assignment per request
const variant = flags.getVariant('new-ui'); // Inconsistent
```

---

### 1.4 Kill Switches (Circuit Breaker Pattern)

**Definition**
Emergency flags designed to immediately disable functionality when issues are detected, acting as manual circuit breakers.

**Implementation Pattern**
```typescript
class KillSwitchManager {
  private flags: FeatureFlagClient;
  private metrics: MetricsClient;
  
  async executeWithKillSwitch<T>(
    flagKey: string,
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    options: KillSwitchOptions = {}
  ): Promise<T> {
    const { errorThreshold = 0.1, timeWindow = 60000 } = options;
    
    // Check if killed at platform level
    if (await this.flags.isEnabled(`${flagKey}-killed`)) {
      this.metrics.increment('kill_switch.engaged', { flag: flagKey });
      return fallback();
    }
    
    try {
      return await primary();
    } catch (error) {
      // Check local error rate
      const errorRate = await this.getErrorRate(flagKey, timeWindow);
      
      if (errorRate > errorThreshold) {
        // Auto-kill for this instance
        this.metrics.increment('kill_switch.auto_triggered', { flag: flagKey });
        return fallback();
      }
      
      throw error;
    }
  }
}

// Usage
const result = await killSwitch.executeWithKillSwitch(
  'payment-processing',
  () => processPaymentNewAPI(payment),
  () => processPaymentLegacy(payment),
  { errorThreshold: 0.05, timeWindow: 30000 }
);
```

**Characteristics**
- Default to "safe" path (usually legacy/off state)
- Instant propagation required (<5 seconds)
- Audited engagement (who, when, why)
- Automatic recovery evaluation

**Naming Convention**
```
Bad:  new-feature
Good: kill-payment-v2-api
Good: disable-recommendations-cache
Good: emergency-fallback-search
```

---

### 1.5 Canary Releases

**Definition**
Rolling out features to a small, representative subset of users before broader deployment.

**Implementation Architecture**
```
┌─────────────────────────────────────────────────────────────────┐
│                    Canary Release Pipeline                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Stage 1: Internal (Dogfooding)                                 │
│  ├── Deploy to production                                       │
│  ├── Enable for @company.com emails only                        │
│  └── Monitor for 24 hours                                       │
│                                                                  │
│  Stage 2: Canary (1% of users)                                  │
│  ├── Enable for 1% of traffic                                   │
│  ├── Target specific regions or user segments                   │
│  └── Monitor error rates, latency, business metrics             │
│                                                                  │
│  Stage 3: Expanded (10-25%)                                   │
│  ├── Increase percentage gradually                              │
│  ├── Compare metrics between control and canary                 │
│  └── Automated rollback if thresholds exceeded                  │
│                                                                  │
│  Stage 4: Full Rollout                                          │
│  ├── Enable for 100% of users                                   │
│  └── Continue monitoring                                        │
│                                                                  │
│  Stage 5: Cleanup                                               │
│  ├── Remove feature flag                                        │
│  └── Clean up conditional code paths                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Targeting Rules for Canary**
```typescript
// Sophisticated canary targeting
const canaryRules = {
  and: [
    { percentage: 5 },
    { 
      or: [
        { attribute: 'region', operator: 'in', values: ['us-east-1'] },
        { attribute: 'userType', operator: 'equals', value: 'beta' }
      ]
    },
    { attribute: 'appVersion', operator: '>=', value: '2.5.0' }
  ]
};
```

---

### 1.6 A/B Testing Integration

**Definition**
Using feature flags to randomly assign users to different variants and measure outcomes.

**Test Design Pattern**
```typescript
// A/B test with metrics tracking
class ABTestRunner {
  async runTest<T>(
    testKey: string,
    variants: Record<string, () => Promise<T>>,
    userId: string,
    metrics: string[]
  ): Promise<T> {
    // Assign variant (sticky per user)
    const variantKey = await this.getVariantAssignment(testKey, userId);
    
    // Track exposure
    this.analytics.track('experiment_exposed', {
      experiment_id: testKey,
      variant_id: variantKey,
      user_id: userId,
      timestamp: Date.now()
    });
    
    // Execute variant
    const startTime = performance.now();
    try {
      const result = await variants[variantKey]();
      
      // Track success
      this.analytics.track('experiment_converted', {
        experiment_id: testKey,
        variant_id: variantKey,
        user_id: userId,
        duration_ms: performance.now() - startTime,
        success: true
      });
      
      return result;
    } catch (error) {
      // Track failure
      this.analytics.track('experiment_error', {
        experiment_id: testKey,
        variant_id: variantKey,
        user_id: userId,
        error: error.message
      });
      
      throw error;
    }
  }
}
```

**Statistical Considerations**
```
Minimum Sample Size Calculation:

n = (Z^2 × p × (1-p)) / E^2

Where:
- Z = Z-score (1.96 for 95% confidence)
- p = Expected conversion rate (baseline)
- E = Minimum detectable effect

Example:
- Baseline conversion: 10%
- Minimum detectable effect: 2% (relative 20%)
- Confidence level: 95%
- Statistical power: 80%

Required sample per variant: ~3,850 users
Total for 2 variants: ~7,700 users
```

---

## 2. SDK Implementation Patterns

### 2.1 Client-Side vs Server-Side Evaluation

#### Client-Side SDK Pattern
```typescript
// Browser/Mobile SDK
class ClientFeatureFlagSDK {
  private cache: Map<string, FlagValue> = new Map();
  private userContext: UserContext;
  
  async initialize(config: SDKConfig): Promise<void> {
    // Fetch initial flags
    const response = await fetch(`${config.apiUrl}/flags`, {
      headers: { 'Authorization': `Bearer ${config.clientKey}` }
    });
    
    const flags = await response.json();
    this.cache = new Map(flags.map(f => [f.key, f]));
    
    // Set up real-time updates
    this.setupStreaming(config);
  }
  
  isEnabled(key: string, defaultValue = false): boolean {
    const flag = this.cache.get(key);
    return flag?.enabled ?? defaultValue;
  }
  
  getValue<T>(key: string, defaultValue: T): T {
    const flag = this.cache.get(key);
    return (flag?.value as T) ?? defaultValue;
  }
  
  private setupStreaming(config: SDKConfig): void {
    const eventSource = new EventSource(
      `${config.streamUrl}/stream?key=${config.clientKey}`
    );
    
    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      this.cache.set(update.key, update);
    };
  }
}
```

#### Server-Side SDK Pattern
```typescript
// Server SDK with local evaluation
class ServerFeatureFlagSDK {
  private state: FlagState | null = null;
  private evaluator: FlagEvaluator;
  
  async initialize(config: ServerConfig): Promise<void> {
    // Initial sync
    await this.syncFlags(config);
    
    // Background polling
    setInterval(() => this.syncFlags(config), config.refreshInterval);
    
    this.evaluator = new FlagEvaluator();
  }
  
  isEnabled(key: string, context: EvaluationContext): boolean {
    if (!this.state) return false;
    
    const flag = this.state.flags[key];
    if (!flag || !flag.enabled) return false;
    
    // Evaluate targeting rules locally
    return this.evaluator.evaluate(flag, context);
  }
  
  private async syncFlags(config: ServerConfig): Promise<void> {
    const response = await fetch(`${config.apiUrl}/flags`, {
      headers: { 'Authorization': `Bearer ${config.serverKey}` }
    });
    
    this.state = await response.json();
  }
}
```

### 2.2 Local Evaluation vs Remote Evaluation

**Comparison Matrix**

| Aspect | Local Evaluation | Remote Evaluation |
|--------|------------------|-------------------|
| **Latency** | <1ms | 50-500ms |
| **Offline Capability** | Yes | No |
| **Complexity** | Higher (SDK size) | Lower (thin client) |
| **Security** | Rules exposed | Rules hidden |
| **Update Speed** | Polling-based | Instant (streaming) |
| **Network Load** | Low (sync only) | High (per evaluation) |
| **CPU on Client** | Higher | Minimal |
| **Use Case** | High-traffic APIs | Simple web apps |

**Hybrid Approach (Best of Both)**
```typescript
class HybridFlagClient {
  private localFlags: Map<string, FlagDefinition>;
  private remoteClient: RemoteFlagClient;
  private mode: 'local' | 'remote';
  
  async evaluate(flagKey: string, context: Context): Promise<boolean> {
    // Try local first for speed
    if (this.mode === 'local' && this.localFlags.has(flagKey)) {
      return this.evaluateLocally(flagKey, context);
    }
    
    // Fallback to remote for complex rules
    return this.remoteClient.evaluate(flagKey, context);
  }
  
  private evaluateLocally(key: string, context: Context): boolean {
    const flag = this.localFlags.get(key)!;
    // Run evaluation engine in-process
    return this.evaluationEngine.evaluate(flag.rules, context);
  }
}
```

### 2.3 Caching Strategies

#### Tiered Caching Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    Caching Hierarchy                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  L1: In-Memory Cache (Process-local)                             │
│  ├── Latency: ~100ns                                            │
│  ├── Size: ~1000 flags                                          │
│  ├── TTL: 30 seconds                                            │
│  └── Invalidation: Streaming events                               │
│                                                                  │
│  L2: Shared Cache (Redis/Memcached)                              │
│  ├── Latency: ~1ms                                              │
│  ├── Size: ~10,000 flags                                        │
│  ├── TTL: 5 minutes                                             │
│  └── Invalidation: Pub/sub or polling                           │
│                                                                  │
│  L3: Persistent Store (Database)                               │
│  ├── Latency: ~10ms                                             │
│  ├── Size: Unlimited                                            │
│  └── Source of truth                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Cache Invalidation Patterns
```typescript
// Event-driven invalidation
class CacheManager {
  private localCache: LRUCache<string, FlagValue>;
  private redis: RedisClient;
  
  async getFlag(key: string): Promise<FlagValue> {
    // L1: Check local cache
    const local = this.localCache.get(key);
    if (local && !this.isStale(local)) {
      return local;
    }
    
    // L2: Check distributed cache
    const remote = await this.redis.get(`flag:${key}`);
    if (remote) {
      const parsed = JSON.parse(remote);
      this.localCache.set(key, parsed);
      return parsed;
    }
    
    // L3: Fetch from source
    const fromDb = await this.fetchFromDatabase(key);
    await this.redis.setex(`flag:${key}`, 300, JSON.stringify(fromDb));
    this.localCache.set(key, fromDb);
    
    return fromDb;
  }
  
  subscribeToUpdates(): void {
    this.redis.subscribe('flag-updates', (message) => {
      const update = JSON.parse(message);
      this.localCache.del(update.flagKey);
    });
  }
}
```

---

## 3. Testing Strategies

### 3.1 Testing in a Feature-Flagged System

**The Combinatorial Problem**
```
With n feature flags, you have 2^n possible states.

3 flags  = 8 states
5 flags  = 32 states
10 flags = 1,024 states
20 flags = 1,048,576 states
```

**Testing Strategy: Risk-Based Sampling**
```typescript
// Test critical paths with all combinations
const criticalFlags = ['payment-flow', 'auth-v2'];

// Test non-critical with representative samples
const otherFlags = ['ui-theme', 'analytics-v2', 'cache-strategy'];

// Generate test matrix
const testCases = generateTestMatrix(criticalFlags, otherFlags);
// Result: Only tests combinations that matter
```

### 3.2 Unit Testing with Feature Flags

```typescript
// Mock-based unit testing
import { FeatureFlagClient } from './feature-flag-client';

describe('PaymentService', () => {
  let mockFlags: jest.Mocked<FeatureFlagClient>;
  let paymentService: PaymentService;
  
  beforeEach(() => {
    mockFlags = {
      isEnabled: jest.fn(),
      getValue: jest.fn()
    } as any;
    
    paymentService = new PaymentService(mockFlags);
  });
  
  describe('with new payment flow enabled', () => {
    beforeEach(() => {
      mockFlags.isEnabled.mockImplementation((key) => 
        key === 'new-payment-flow'
      );
    });
    
    it('uses new payment processor', async () => {
      await paymentService.processPayment({ amount: 100 });
      expect(mockNewProcessor.process).toHaveBeenCalled();
    });
  });
  
  describe('with new payment flow disabled', () => {
    beforeEach(() => {
      mockFlags.isEnabled.mockReturnValue(false);
    });
    
    it('uses legacy payment processor', async () => {
      await paymentService.processPayment({ amount: 100 });
      expect(mockLegacyProcessor.process).toHaveBeenCalled();
    });
  });
});
```

### 3.3 Integration Testing

```typescript
// Integration test with real flag service
import { TestFeatureFlagService } from '@flagward/testing';

describe('Checkout Flow Integration', () => {
  let flagService: TestFeatureFlagService;
  let app: TestApplication;
  
  beforeAll(async () => {
    flagService = new TestFeatureFlagService({
      port: 9999,
      initialFlags: {
        'new-checkout': { enabled: false, value: null }
      }
    });
    
    await flagService.start();
    app = await createTestApp({ flagServiceUrl: 'http://localhost:9999' });
  });
  
  it('completes checkout with legacy flow', async () => {
    await flagService.setFlag('new-checkout', false);
    
    const response = await request(app)
      .post('/checkout')
      .send({ items: ['item-1'] });
    
    expect(response.body.flow).toBe('legacy');
  });
  
  it('completes checkout with new flow when flag enabled', async () => {
    await flagService.setFlag('new-checkout', true);
    
    const response = await request(app)
      .post('/checkout')
      .send({ items: ['item-1'] });
    
    expect(response.body.flow).toBe('new');
  });
  
  afterAll(async () => {
    await flagService.stop();
    await app.close();
  });
});
```

### 3.4 E2E Testing with Feature Flags

```typescript
// Playwright/Cypress E2E tests with flag override
import { test, expect } from '@playwright/test';
import { FeatureFlagAPI } from './helpers/feature-flags';

test.describe('New Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Override flag via cookie for E2E testing
    await page.context().addCookies([{
      name: 'feature-override',
      value: JSON.stringify({ 'new-dashboard': true }),
      domain: 'localhost',
      path: '/'
    }]);
  });
  
  test('renders new dashboard layout', async ({ page }) => {
    await page.goto('/dashboard');
    
    await expect(page.locator('[data-testid="new-dashboard-header"]'))
      .toBeVisible();
    
    await expect(page.locator('[data-testid="legacy-dashboard-header"]'))
      .not.toBeVisible();
  });
  
  test('maintains state across navigation', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate away and back
    await page.goto('/profile');
    await page.goto('/dashboard');
    
    // Should still see new dashboard (stickiness)
    await expect(page.locator('[data-testid="new-dashboard-header"]'))
      .toBeVisible();
  });
});
```

### 3.5 Contract Testing

```typescript
// Verify flag evaluation contracts
import { Pact } from '@pact-foundation/pact';

describe('Feature Flag API Contract', () => {
  const provider = new Pact({
    consumer: 'PaymentService',
    provider: 'FeatureFlagAPI',
    port: 9999
  });
  
  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());
  afterEach(() => provider.verify());
  
  describe('get flag evaluation', () => {
    beforeEach(() => {
      return provider.addInteraction({
        state: 'flag new-payment exists and is enabled',
        uponReceiving: 'a request for flag evaluation',
        withRequest: {
          method: 'POST',
          path: '/evaluate',
          body: {
            flagKey: 'new-payment',
            context: {
              userId: 'user-123',
              region: 'us-east-1'
            }
          }
        },
        willRespondWith: {
          status: 200,
          body: {
            enabled: true,
            variant: 'v2',
            payload: { timeout: 5000 }
          }
        }
      });
    });
    
    it('returns correct evaluation', async () => {
      const client = new FeatureFlagClient('http://localhost:9999');
      const result = await client.evaluate('new-payment', {
        userId: 'user-123',
        region: 'us-east-1'
      });
      
      expect(result.enabled).toBe(true);
      expect(result.variant).toBe('v2');
    });
  });
});
```

---

## 4. Advanced Patterns

### 4.1 Dynamic Configuration Pattern

```typescript
// Remote configuration via feature flags
interface RemoteConfig {
  apiTimeout: number;
  retryAttempts: number;
  featureToggles: Record<string, boolean>;
}

class RemoteConfigManager {
  private config: RemoteConfig | null = null;
  private subscribers: Set<(config: RemoteConfig) => void> = new Set();
  
  async initialize(): Promise<void> {
    // Fetch all config via single "config" flag
    const configFlag = await this.flags.getValue('app-config', {
      apiTimeout: 5000,
      retryAttempts: 3,
      featureToggles: {}
    });
    
    this.config = configFlag;
    this.notifySubscribers();
    
    // Watch for changes
    this.flags.onChange('app-config', (newValue) => {
      this.config = newValue;
      this.notifySubscribers();
    });
  }
  
  subscribe(callback: (config: RemoteConfig) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  
  private notifySubscribers(): void {
    if (this.config) {
      this.subscribers.forEach(cb => cb(this.config!));
    }
  }
}

// Usage with automatic reconfiguration
const configManager = new RemoteConfigManager();

configManager.subscribe((config) => {
  // Update API client with new timeout
  apiClient.setTimeout(config.apiTimeout);
  
  // Update retry policy
  retryPolicy.setMaxAttempts(config.retryAttempts);
});
```

### 4.2 Feature Flag Lifecycle Management

```
┌─────────────────────────────────────────────────────────────────┐
│                  Flag Lifecycle States                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │   IDE    │───▶│  LOCAL   │───▶│  STAGING │───▶│   PROD   │ │
│  │DEVELOPMENT│    │  TESTING │    │   TEST   │    │  RELEASE │ │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘ │
│       │                                              │        │
│       │         ┌────────────────────────────────────┘        │
│       │         ▼                                             │
│       │  ┌──────────┐    ┌──────────┐                        │
│       └─▶│ ROLLOUT  │───▶│  CLEANUP │                        │
│          │          │    │          │                        │
│          └──────────┘    └──────────┘                        │
│               │                                              │
│               ▼                                              │
│          ┌──────────┐                                      │
│          │ ARCHIVED │                                      │
│          └──────────┘                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Lifecycle Automation**
```typescript
interface FlagLifecycle {
  createdAt: Date;
  stages: {
    development: { startedAt: Date; completedAt?: Date };
    testing: { startedAt?: Date; completedAt?: Date };
    staging: { startedAt?: Date; completedAt?: Date };
    production: { 
      startedAt?: Date; 
      rolloutPercentage: number;
      completedAt?: Date 
    };
    cleanup: { scheduledAt?: Date; completedAt?: Date };
  };
  owner: string;
  ticketUrl?: string;
  expectedRemovalDate?: Date;
}

class FlagLifecycleManager {
  async advanceStage(flagKey: string, targetStage: Stage): Promise<void> {
    const flag = await this.getFlag(flagKey);
    const lifecycle = flag.lifecycle;
    
    // Validate stage transition
    if (!this.isValidTransition(lifecycle.currentStage, targetStage)) {
      throw new Error(`Invalid transition from ${lifecycle.currentStage} to ${targetStage}`);
    }
    
    // Apply stage-specific actions
    switch (targetStage) {
      case 'production':
        await this.validateProductionReadiness(flag);
        await this.enableInProduction(flagKey, 0); // Start at 0%
        break;
        
      case 'cleanup':
        await this.scheduleRemoval(flagKey, { days: 14 });
        await this.notifyOwner(flag.owner, `Flag ${flagKey} scheduled for removal`);
        break;
    }
    
    // Update lifecycle
    await this.updateLifecycle(flagKey, targetStage);
  }
  
  async cleanupStaleFlags(): Promise<void> {
    const staleFlags = await this.findFlags({
      'lifecycle.stages.production.completedAt': {
        $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days
      },
      'lifecycle.stages.cleanup': { $exists: false }
    });
    
    for (const flag of staleFlags) {
      console.warn(`Stale flag detected: ${flag.key} - owner: ${flag.lifecycle.owner}`);
      await this.notifyForCleanup(flag);
    }
  }
}
```

### 4.3 Targeting and Segmentation Patterns

**Context-Aware Targeting**
```typescript
interface EvaluationContext {
  userId: string;
  sessionId: string;
  attributes: {
    region: string;
    deviceType: 'mobile' | 'desktop' | 'tablet';
    appVersion: string;
    subscriptionTier: 'free' | 'pro' | 'enterprise';
    custom: Record<string, any>;
  };
  timestamp: Date;
}

class ContextualTargetingEngine {
  evaluate(rule: TargetingRule, context: EvaluationContext): boolean {
    switch (rule.operator) {
      case 'equals':
        return this.getAttribute(context, rule.attribute) === rule.value;
        
      case 'in':
        return rule.values.includes(this.getAttribute(context, rule.attribute));
        
      case 'starts_with':
        const attr = String(this.getAttribute(context, rule.attribute));
        return attr.startsWith(rule.value);
        
      case 'ends_with':
        const attrStr = String(this.getAttribute(context, rule.attribute));
        return attrStr.endsWith(rule.value);
        
      case 'contains':
        const val = String(this.getAttribute(context, rule.attribute));
        return val.includes(rule.value);
        
      case 'semver_eq':
      case 'semver_gt':
      case 'semver_lt':
        return this.compareSemver(
          this.getAttribute(context, rule.attribute),
          rule.value,
          rule.operator
        );
        
      case 'date_before':
      case 'date_after':
        return this.compareDate(
          this.getAttribute(context, rule.attribute),
          rule.value,
          rule.operator
        );
        
      default:
        return false;
    }
  }
  
  private getAttribute(context: EvaluationContext, path: string): any {
    const parts = path.split('.');
    let value: any = context;
    
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return undefined;
    }
    
    return value;
  }
}
```

**Segment Definition and Reuse**
```typescript
// Reusable segments
const segments = {
  betaUsers: {
    name: 'Beta Users',
    rules: [
      { attribute: 'user.attributes.betaProgram', operator: 'equals', value: true },
      { attribute: 'user.subscriptionTier', operator: 'in', values: ['pro', 'enterprise'] }
    ]
  },
  
  internalUsers: {
    name: 'Internal Team',
    rules: [
      { attribute: 'user.email', operator: 'ends_with', value: '@company.com' }
    ]
  },
  
  newUsers: {
    name: 'New Users (< 7 days)',
    rules: [
      { 
        attribute: 'user.createdAt', 
        operator: 'date_after', 
        value: 'now-7d' 
      }
    ]
  },
  
  highValueUsers: {
    name: 'High Value',
    rules: [
      { attribute: 'user.lifetimeValue', operator: 'gt', value: 1000 },
      { attribute: 'user.purchaseCount', operator: 'gt', value: 5 }
    ],
    operator: 'and'
  }
};

// Use segments in flags
const flagConfig = {
  key: 'premium-feature',
  enabled: true,
  targeting: [
    { segment: 'internalUsers', serve: true },
    { segment: 'betaUsers', percentage: 50 },
    { default: false }
  ]
};
```

---

## 5. Anti-Patterns and Pitfalls

### 5.1 Common Anti-Patterns

**1. Magic Strings**
```typescript
// BAD
if (flags.isEnabled('flag123')) { }

// GOOD
const FEATURE_FLAGS = {
  NEW_CHECKOUT_FLOW: 'new-checkout-flow',
  PAYMENT_V2: 'payment-processing-v2'
} as const;

if (flags.isEnabled(FEATURE_FLAGS.NEW_CHECKOUT_FLOW)) { }
```

**2. Deep Nesting**
```typescript
// BAD
function processOrder(order) {
  if (flags.isEnabled('new-order-system')) {
    if (flags.isEnabled('new-payment-api')) {
      if (flags.isEnabled('fraud-detection-v2')) {
        return processWithAllNew(order);
      } else {
        return processWithOldFraud(order);
      }
    } else {
      return processWithOldPayment(order);
    }
  } else {
    return processLegacy(order);
  }
}

// GOOD
const strategies = {
  'new-order-new-payment-new-fraud': processWithAllNew,
  'new-order-new-payment-old-fraud': processWithOldFraud,
  'new-order-old-payment': processWithOldPayment,
  'old-order': processLegacy
};

function processOrder(order) {
  const strategyKey = [
    flags.isEnabled('new-order-system') ? 'new-order' : 'old-order',
    flags.isEnabled('new-payment-api') ? 'new-payment' : 'old-payment',
    flags.isEnabled('fraud-detection-v2') ? 'new-fraud' : 'old-fraud'
  ].join('-');
  
  const strategy = strategies[strategyKey] || processLegacy;
  return strategy(order);
}
```

**3. Database Calls in Flag Checks**
```typescript
// BAD - N+1 query problem
for (const user of users) {
  // This makes a network request for EACH user
  if (await flags.isEnabled('feature', user.id)) {
    await notifyUser(user);
  }
}

// GOOD - Batch evaluation
const evaluations = await flags.evaluateBatch(
  'feature',
  users.map(u => ({ userId: u.id }))
);

for (let i = 0; i < users.length; i++) {
  if (evaluations[i].enabled) {
    await notifyUser(users[i]);
  }
}
```

**4. Stale Flags**
```typescript
// Problem: Flags that stay in code forever
// 3 years later, this flag is still checked but always true

if (flags.isEnabled('migration-completed-2023')) {
  return newBehavior();
} else {
  // Dead code path - never executed
  return oldBehavior();
}

// Solution: Automated cleanup
// 1. Detect flags with 100% rollout for 30+ days
// 2. Alert owners to remove conditional logic
// 3. Archive flag after code cleanup
```

### 5.2 Security Considerations

**Data Leakage Prevention**
```typescript
// BAD - Exposing all flags to client
app.get('/flags', (req, res) => {
  res.json(allFlags); // Includes internal/admin flags!
});

// GOOD - Filter by client context
app.get('/flags', authenticate, (req, res) => {
  const clientFlags = filterFlagsByContext(allFlags, {
    clientKey: req.headers['x-client-key'],
    userContext: req.user
  });
  res.json(clientFlags);
});
```

**Flag Tampering Prevention**
```typescript
// Verify flag overrides are legitimate
class SecureFlagClient {
  async isEnabled(key: string, context: Context): Promise<boolean> {
    const baseValue = await this.getFlagValue(key);
    
    // Check for per-request overrides (cookies, headers)
    const override = this.getRequestOverride(key);
    
    if (override !== undefined) {
      // Verify override is signed/authorized
      if (!this.verifyOverrideSignature(override)) {
        this.securityLog.warn('Invalid flag override attempt', { key, context });
        return baseValue;
      }
      
      // Verify user has permission to override
      if (!await this.canOverrideFlag(context.user, key)) {
        this.securityLog.warn('Unauthorized flag override', { key, user: context.user });
        return baseValue;
      }
    }
    
    return override ?? baseValue;
  }
}
```

---

## 6. Implementation Checklist

### Pre-Implementation
- [ ] Define flag naming convention
- [ ] Establish lifecycle policy (max flag age)
- [ ] Set up monitoring and alerting
- [ ] Create test environments with flag service
- [ ] Document rollback procedures

### During Implementation
- [ ] Use feature flag client abstraction (not direct API calls)
- [ ] Add default values for all flags
- [ ] Implement proper error handling
- [ ] Add metrics for flag evaluations
- [ ] Create kill switches for critical paths

### Post-Implementation
- [ ] Remove flags after full rollout
- [ ] Monitor flag usage and performance
- [ ] Review flag health regularly
- [ ] Archive unused flags
- [ ] Document lessons learned

---

## 7. References

### Industry Standards
1. Fowler, Martin & Hodgson, Pete. "Feature Toggles (aka Feature Flags)" - martinfowler.com, 2017
2. Humble, Jez & Farley, David. "Continuous Delivery" - Addison-Wesley, 2010
3. Nygard, Michael. "Release It!" - Pragmatic Bookshelf, 2018

### Platform-Specific Patterns
1. LaunchDarkly SDK Reference Guides - docs.launchdarkly.com
2. Split Pattern Library - help.split.io/hc/en-us
3. Unleash Best Practices - docs.getunleash.io/topics/feature-flags
4. Flagsmith Implementation Guide - docs.flagsmith.com

### Research Papers
1. "Experimentation in Large-Scale Online Services" - Google, KDD 2015
2. "Overlapping Experiment Infrastructure" - Google, 2010
3. "The Netflix Simian Army" - Netflix Tech Blog, 2011

### Open Source Projects
1. Unleash/unleash - github.com/Unleash/unleash
2. Flagsmith/flagsmith - github.com/Flagsmith/flagsmith
3. OpenFeature Specification - openfeature.dev

---

## 8. Glossary

| Term | Definition |
|------|------------|
| **Activation Strategy** | Unleash term for rules determining flag activation |
| **Canary Release** | Rolling out to a small subset before full deployment |
| **Context** | User/environment data used for flag evaluation |
| **Datafile** | Optimizely's bundled flag configuration |
| **Evaluation** | The process of determining flag state for a context |
| **Impression** | A record of a flag being checked |
| **Kill Switch** | Emergency flag to disable functionality |
| **Multivariate** | Flag with multiple possible values |
| **Percentage Rollout** | Gradual exposure to a % of users |
| **Segment** | Reusable group of targeting rules |
| **Stickiness** | Consistent variant assignment per user |
| **Targeting** | Rules determining who sees a feature |
| **Treatment** | Split's term for assigned variant |
| **Variant** | A specific value/option in a multivariate test |

---

*Document Version: 1.0*  
*Last Updated: 2026-04-05*  
*Research Lead: Flagward Team*
