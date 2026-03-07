#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DaleStack } from '../lib/dale-stack.js';
import { environments } from '../config.js';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') as string | undefined;
if (!envName) {
  throw new Error('Missing required context: -c env=dev|staging|prod');
}

const envConfig = environments[envName];
if (!envConfig) {
  throw new Error(`Unknown environment "${envName}". Valid: ${Object.keys(environments).join(', ')}`);
}

const stackName = `Dale-${envName.charAt(0).toUpperCase()}${envName.slice(1)}`;

new DaleStack(app, stackName, {
  envName,
  retainData: envConfig.retainData,
  telegramTestMode: envConfig.telegramTestMode,
  blueGreenDeployment: envConfig.blueGreenDeployment,
});
