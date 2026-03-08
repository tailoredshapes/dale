/**
 * Setup script for local development environment
 * Creates DynamoDB table and seeds SSM parameters
 */
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';
import https from 'node:https';

// LocalStack 3.0 uses self-signed TLS — skip cert verification for local dev
const localAgent = new https.Agent({ rejectUnauthorized: false });

const dynamoEndpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
const ssmEndpoint = process.env.SSM_ENDPOINT || 'http://localhost:4566';
const tableName = process.env.TABLE_NAME || 'dale-local';

const dynamodb = new DynamoDBClient({
  endpoint: dynamoEndpoint,
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

const ssm = new SSMClient({
  endpoint: ssmEndpoint,
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
  requestHandler: { httpsAgent: localAgent } as any,
});

async function tableExists(): Promise<boolean> {
  try {
    await dynamodb.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (err: any) {
    if (err.name === 'ResourceNotFoundException') {
      return false;
    }
    throw err;
  }
}

async function createTable(): Promise<void> {
  console.log(`Creating DynamoDB table: ${tableName}`);

  await dynamodb.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'GSI1pk', AttributeType: 'S' },
        { AttributeName: 'GSI1sk', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1pk', KeyType: 'HASH' },
            { AttributeName: 'GSI1sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    }),
  );

  console.log('Table created successfully');
}

async function seedSSMParameters(): Promise<void> {
  console.log('Seeding SSM parameters for test tenant...');

  const testTenantId = 'test-tenant';
  const params = [
    { key: 'telegram-bot-token', value: '123456789:TEST_BOT_TOKEN' },
    { key: 'telegram-webhook-secret', value: 'test-webhook-secret' },
    { key: 'stripe-secret-key', value: 'sk_test_fake' },
    { key: 'stripe-webhook-secret', value: 'whsec_test_fake' },
  ];

  for (const { key, value } of params) {
    await ssm.send(
      new PutParameterCommand({
        Name: `/dale/tenants/${testTenantId}/${key}`,
        Value: value,
        Type: 'SecureString',
        Overwrite: true,
      }),
    );
    console.log(`  Set /dale/tenants/${testTenantId}/${key}`);
  }

  console.log('SSM parameters seeded successfully');
}

async function main(): Promise<void> {
  console.log('Setting up local development environment...\n');
  console.log(`DynamoDB endpoint: ${dynamoEndpoint}`);
  console.log(`SSM endpoint: ${ssmEndpoint}`);
  console.log(`Table name: ${tableName}\n`);

  // Wait for services to be ready
  let retries = 0;
  while (retries < 30) {
    try {
      await dynamodb.send(new DescribeTableCommand({ TableName: 'nonexistent' }));
    } catch (err: any) {
      if (err.name === 'ResourceNotFoundException') {
        // DynamoDB is ready
        break;
      }
      if (err.code === 'ECONNREFUSED' || err.name === 'NetworkingError') {
        console.log(`Waiting for DynamoDB... (attempt ${retries + 1})`);
        await new Promise((r) => setTimeout(r, 1000));
        retries++;
        continue;
      }
    }
    break;
  }

  // Create table if it doesn't exist
  if (await tableExists()) {
    console.log(`Table ${tableName} already exists`);
  } else {
    await createTable();
  }

  // Seed SSM parameters
  await seedSSMParameters();

  console.log('\nSetup complete!');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
