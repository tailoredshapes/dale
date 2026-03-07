import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Runtime, FunctionUrlAuthType, Architecture } from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface WebhooksProps {
  table: dynamodb.Table;
  ssmParamArns: string[];
  telegramTestMode?: boolean;
  paypalBaseUrl?: string;
}

export class Webhooks extends Construct {
  public readonly telegramUrl: cdk.aws_lambda.FunctionUrl;
  public readonly stripeUrl: cdk.aws_lambda.FunctionUrl;
  public readonly paypalUrl: cdk.aws_lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: WebhooksProps) {
    super(scope, id);

    const commonEnv = {
      TABLE_NAME: props.table.tableName,
      ...(props.telegramTestMode ? { TELEGRAM_TEST_MODE: 'true' } : {}),
    };

    const bundling = {
      externalModules: ['@aws-sdk/*'],
      format: lambda.OutputFormat.ESM,
      target: 'node20',
    };

    const telegramHandler = new lambda.NodejsFunction(this, 'TelegramHandler', {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      entry: path.join(__dirname, '../../../src/telegram/webhook.ts'),
      handler: 'handler',
      environment: commonEnv,
      bundling: {
        ...bundling,
        nodeModules: ['ulid'],
      },
      timeout: cdk.Duration.seconds(15),
    });

    const stripeHandler = new lambda.NodejsFunction(this, 'StripeHandler', {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      entry: path.join(__dirname, '../../../src/stripe/webhook.ts'),
      handler: 'handler',
      environment: commonEnv,
      bundling: {
        ...bundling,
        externalModules: ['@aws-sdk/*'],
        nodeModules: ['stripe'],
      },
      timeout: cdk.Duration.seconds(15),
    });

    const paypalHandler = new lambda.NodejsFunction(this, 'PayPalHandler', {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      entry: path.join(__dirname, '../../../src/paypal/webhook.ts'),
      handler: 'handler',
      environment: {
        ...commonEnv,
        PAYPAL_BASE_URL: props.paypalBaseUrl ?? 'https://api-m.paypal.com',
      },
      bundling,
      timeout: cdk.Duration.seconds(15),
    });

    props.table.grantReadWriteData(telegramHandler);
    props.table.grantReadWriteData(stripeHandler);
    props.table.grantReadWriteData(paypalHandler);

    const ssmPolicy = new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParametersByPath'],
      resources: props.ssmParamArns,
    });
    telegramHandler.addToRolePolicy(ssmPolicy);
    stripeHandler.addToRolePolicy(ssmPolicy);
    paypalHandler.addToRolePolicy(ssmPolicy);

    this.telegramUrl = telegramHandler.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    });

    this.stripeUrl = stripeHandler.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    });

    this.paypalUrl = paypalHandler.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    });
  }
}
