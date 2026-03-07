import { DynamoDBClient, QueryCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { SSMClient, GetParametersByPathCommand, DeleteParameterCommand } from '@aws-sdk/client-ssm';
import type { E2EConfig } from '../env.js';

function getDynamoClient(config: E2EConfig): DynamoDBClient {
  if (config.localMode && config.dynamoDbEndpoint) {
    return new DynamoDBClient({
      endpoint: config.dynamoDbEndpoint,
      region: config.region,
      credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local',
      },
    });
  }
  return new DynamoDBClient({});
}

function getSSMClient(config: E2EConfig): SSMClient {
  if (config.localMode && config.ssmEndpoint) {
    return new SSMClient({
      endpoint: config.ssmEndpoint,
      region: config.region,
      credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local',
      },
    });
  }
  return new SSMClient({});
}

export async function cleanupDynamoDBTenant(config: E2EConfig, tenantId: string): Promise<void> {
  const dynamoClient = getDynamoClient(config);
  const tableName = config.tableName;
  const prefix = `TENANT#${tenantId}`;

  // Query all items with pk starting with TENANT#{tenantId}
  let lastKey: any;
  do {
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': { S: prefix },
        },
        ExclusiveStartKey: lastKey,
      }),
    );

    if (result.Items && result.Items.length > 0) {
      // Batch delete in groups of 25
      for (let i = 0; i < result.Items.length; i += 25) {
        const batch = result.Items.slice(i, i + 25);
        await dynamoClient.send(
          new BatchWriteItemCommand({
            RequestItems: {
              [tableName]: batch.map((item) => ({
                DeleteRequest: {
                  Key: { pk: item.pk, sk: item.sk },
                },
              })),
            },
          }),
        );
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
}

export async function cleanupWebhookSecret(config: E2EConfig, webhookSecret: string): Promise<void> {
  const dynamoClient = getDynamoClient(config);
  const tableName = config.tableName;
  const pk = `WHSECRET#${webhookSecret}`;
  try {
    await dynamoClient.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [tableName]: [
            {
              DeleteRequest: {
                Key: {
                  pk: { S: pk },
                  sk: { S: 'TENANT' },
                },
              },
            },
          ],
        },
      }),
    );
  } catch {
    // ignore
  }
}

export async function cleanupSSMParams(config: E2EConfig, tenantId: string): Promise<void> {
  const ssmClient = getSSMClient(config);
  const path = `/dale/tenants/${tenantId}/`;

  try {
    let nextToken: string | undefined;
    do {
      const result = await ssmClient.send(
        new GetParametersByPathCommand({
          Path: path,
          NextToken: nextToken,
        }),
      );

      if (result.Parameters) {
        for (const param of result.Parameters) {
          if (param.Name) {
            await ssmClient.send(
              new DeleteParameterCommand({ Name: param.Name }),
            );
          }
        }
      }

      nextToken = result.NextToken;
    } while (nextToken);
  } catch {
    // ignore if path doesn't exist
  }
}
