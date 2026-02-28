import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

import { getTenantIdByWebhookSecret, resetWebhookSecretCache } from '../tenant-lookup.js';

const TABLE = 'dale-test-table';

beforeEach(() => {
  ddbMock.reset();
  resetWebhookSecretCache();
});

describe('getTenantIdByWebhookSecret', () => {
  it('returns tenantId when mapping exists', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { pk: 'WHSECRET#my-secret', sk: 'TENANT', tenantId: 'tenant-1' },
    });

    const result = await getTenantIdByWebhookSecret(TABLE, 'my-secret');

    expect(result).toBe('tenant-1');
    const calls = ddbMock.commandCalls(GetCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toEqual({
      TableName: TABLE,
      Key: { pk: 'WHSECRET#my-secret', sk: 'TENANT' },
    });
  });

  it('returns null when no mapping found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const result = await getTenantIdByWebhookSecret(TABLE, 'unknown-secret');

    expect(result).toBeNull();
  });

  it('returns cached value on second call', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { pk: 'WHSECRET#sec', sk: 'TENANT', tenantId: 'tenant-1' },
    });

    await getTenantIdByWebhookSecret(TABLE, 'sec');
    const result = await getTenantIdByWebhookSecret(TABLE, 'sec');

    expect(result).toBe('tenant-1');
    expect(ddbMock.commandCalls(GetCommand)).toHaveLength(1);
  });

  it('does not cache null results', async () => {
    ddbMock.on(GetCommand).resolvesOnce({ Item: undefined }).resolvesOnce({
      Item: { pk: 'WHSECRET#sec', sk: 'TENANT', tenantId: 'tenant-1' },
    });

    const first = await getTenantIdByWebhookSecret(TABLE, 'sec');
    const second = await getTenantIdByWebhookSecret(TABLE, 'sec');

    expect(first).toBeNull();
    expect(second).toBe('tenant-1');
    expect(ddbMock.commandCalls(GetCommand)).toHaveLength(2);
  });

  it('caches per secret independently', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { pk: 'WHSECRET#sec', sk: 'TENANT', tenantId: 'tenant-1' },
    });

    await getTenantIdByWebhookSecret(TABLE, 'secret-a');
    await getTenantIdByWebhookSecret(TABLE, 'secret-b');

    expect(ddbMock.commandCalls(GetCommand)).toHaveLength(2);
  });
});
