/**
 * Setup script for local development environment
 * Seeds test tenant data via meshql-rs GraphQL mutations
 */
const meshqlUrl = process.env.MESHQL_URL || 'http://meshql-rs:8080';

async function graphqlMutation(entity: string, data: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${meshqlUrl}/${entity}/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to create ${entity}: ${response.statusText}`);
  }
}

async function seedTestData(): Promise<void> {
  console.log('Seeding test data via meshql-rs...\n');

  // Create test tenant with all secrets included
  console.log('Creating test tenant...');
  await graphqlMutation('tenant', {
    id: 'test-tenant',
    display_name: 'Test Creator',
    telegram_bot_token: '123456789:TEST_BOT_TOKEN',
    webhook_secret: 'test-webhook-secret',
    stripe_secret_key: 'sk_test_fake',
    stripe_webhook_secret: 'whsec_test_fake',
  });
  console.log('  Created tenant: test-tenant');

  console.log('\nSetup complete!');
}

async function waitForMeshql(): Promise<void> {
  console.log(`Waiting for meshql-rs at ${meshqlUrl}...`);
  let retries = 0;
  while (retries < 30) {
    try {
      const response = await fetch(`${meshqlUrl}/health`);
      if (response.ok) {
        console.log('meshql-rs is ready!\n');
        return;
      }
    } catch {
      // Service not ready yet
    }
    console.log(`  Attempt ${retries + 1}/30...`);
    await new Promise((r) => setTimeout(r, 1000));
    retries++;
  }
  throw new Error('meshql-rs did not become ready in time');
}

async function main(): Promise<void> {
  console.log('Setting up local development environment...\n');
  console.log(`MeshQL URL: ${meshqlUrl}\n`);

  await waitForMeshql();
  await seedTestData();
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
