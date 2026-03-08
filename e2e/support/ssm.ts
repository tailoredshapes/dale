import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import type { E2EConfig } from '../env.js';

function getSSMClient(config?: E2EConfig): SSMClient {
  if (config?.localMode && config.ssmEndpoint) {
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

export async function getSSMParameter(name: string, config?: E2EConfig): Promise<string> {
  const ssmClient = getSSMClient(config);
  const result = await ssmClient.send(
    new GetParameterCommand({
      Name: name,
      WithDecryption: true,
    }),
  );

  if (!result.Parameter?.Value) {
    throw new Error(`SSM parameter ${name} not found or empty`);
  }

  return result.Parameter.Value;
}
