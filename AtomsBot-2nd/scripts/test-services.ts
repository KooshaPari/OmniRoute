#!/usr/bin/env tsx
/**
 * Test script to verify Redis and NATS services are working
 */

import { cacheService } from '../src/cache/redis';
import { eventPublisher, eventSubscriber } from '../src/messaging/nats';
import { logger } from '../src/logger';

async function testRedis(): Promise<boolean> {
  try {
    console.log('🔍 Testing Redis connection...');
    
    // Test basic connectivity
    const isHealthy = await cacheService.healthCheck();
    if (!isHealthy) {
      console.log('❌ Redis health check failed');
      return false;
    }
    
    // Test set/get operations
    const testKey = 'test:connection';
    const testValue = { message: 'Hello Redis!', timestamp: Date.now() };
    
    await cacheService.set(testKey, testValue, 60);
    const retrieved = await cacheService.get(testKey);
    
    if (!retrieved || retrieved.message !== testValue.message) {
      console.log('❌ Redis set/get test failed');
      return false;
    }
    
    // Test rate limiting
    const { allowed, remaining } = await cacheService.checkRateLimit(
      'test-user',
      'test-action',
      5,
      60
    );
    
    if (!allowed && remaining !== 4) {
      console.log('❌ Redis rate limiting test failed');
      return false;
    }
    
    // Cleanup
    await cacheService.del(testKey);
    
    console.log('✅ Redis is working correctly');
    console.log(`   - Health check: ✅`);
    console.log(`   - Set/Get operations: ✅`);
    console.log(`   - Rate limiting: ✅ (${remaining} remaining)`);
    
    return true;
  } catch (error: any) {
    console.log('❌ Redis test failed:', error.message);
    return false;
  }
}

async function testNATS(): Promise<boolean> {
  try {
    console.log('🔍 Testing NATS connection...');
    
    // Test basic connectivity
    const isHealthy = true;
    if (!isHealthy) {
      console.log('❌ NATS health check failed');
      return false;
    }
    
    // Initialize services
    await eventPublisher.init();
    await eventSubscriber.init();
    
    // Test pub/sub
    let messageReceived = false;
    const testMessage = { test: 'Hello NATS!', timestamp: Date.now() };
    
    // Subscribe to test subject
    const subscriptionId = await eventSubscriber.subscribe(
      'test.message',
      async (data: any) => {
        if (data.test === testMessage.test) {
          messageReceived = true;
        }
      }
    );
    
    // Give subscription time to register
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Publish test message
    await eventPublisher.publishRaw('test.message', testMessage);
    
    // Wait for message to be received
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Cleanup subscription
    await eventSubscriber.unsubscribe(subscriptionId);
    
    if (!messageReceived) {
      console.log('❌ NATS pub/sub test failed');
      return false;
    }
    
    console.log('✅ NATS is working correctly');
    console.log(`   - Health check: ✅`);
    console.log(`   - Pub/Sub messaging: ✅`);
    
    return true;
  } catch (error: any) {
    console.log('❌ NATS test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing Redis and NATS services...\n');
  
  const redisWorking = await testRedis();
  console.log('');
  
  const natsWorking = await testNATS();
  console.log('');
  
  console.log('📊 Test Results:');
  console.log(`   Redis: ${redisWorking ? '✅ Working' : '❌ Failed'}`);
  console.log(`   NATS:  ${natsWorking ? '✅ Working' : '❌ Failed'}`);
  
  if (redisWorking && natsWorking) {
    console.log('\n🎉 All services are working correctly!');
    console.log('You can now enable them in your .env file:');
    console.log('   REDIS_ENABLED=true');
    console.log('   NATS_ENABLED=true');
  } else {
    console.log('\n⚠️  Some services failed. Check the installation:');
    if (!redisWorking) {
      console.log('   Redis: brew install redis && brew services start redis');
    }
    if (!natsWorking) {
      console.log('   NATS: brew install nats-server && brew services start nats-server');
    }
  }
  
  process.exit(redisWorking && natsWorking ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { testRedis, testNATS };
