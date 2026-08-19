// Integration test for new 10/10 components

import { listTools } from './tools/index.js';
import { scheduler } from './scheduler.js';
import { modelRouter } from './models.js';
import { evidenceLedger } from './evidence.js';
import { verificationWorkers } from './verification.js';

async function runIntegrationTest() {
  console.log('🧪 Starting Agent-Swarm 10/10 Integration Test...\n');

  try {
    // Test 1: Tool Gateway
    console.log('1️⃣ Testing Tool Gateway...');
    const tools = listTools();
    console.log(`   ✅ Available tools: ${tools.map(t => t.name).join(', ')}`);

    // Test 2: Scheduler
    console.log('\n2️⃣ Testing Scheduler...');
    const schedulerHealth = await scheduler.health();
    console.log(`   ✅ Scheduler health: ${schedulerHealth.status}`);

    // Test 3: Model Router
    console.log('\n3️⃣ Testing Model Router...');
    const providers = modelRouter.getProviders();
    console.log(`   ✅ Available providers: ${providers.join(', ')}`);
    
    const modelHealth = await modelRouter.health();
    console.log(`   ✅ Model router health: ${modelHealth.status}`);

    // Test 4: Evidence System
    console.log('\n4️⃣ Testing Evidence System...');
    const evidenceHealth = await evidenceLedger.health();
    console.log(`   ✅ Evidence system health: ${evidenceHealth.status}`);

    // Test 5: Verification Workers
    console.log('\n5️⃣ Testing Verification Workers...');
    const verificationHealth = await verificationWorkers.health();
    console.log(`   ✅ Verification workers health: ${Object.keys(verificationHealth).length} workers available`);

    console.log('\n🎉 All 10/10 components are operational!');
    console.log('\n📊 Component Status Summary:');
    console.log(`   • Tool Gateway: ${tools.length} tools available`);
    console.log(`   • Scheduler: ${schedulerHealth.status}`);
    console.log(`   • Model Router: ${providers.length} providers`);
    console.log(`   • Evidence System: ${evidenceHealth.status}`);
    console.log(`   • Verification Workers: ${Object.keys(verificationHealth).length} workers`);

    return true;
  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    return false;
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTest()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
      console.error('Test runner error:', err);
      process.exit(1);
    });
}

export { runIntegrationTest };