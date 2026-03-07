import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaBase from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface BlueGreenWebhooksProps {
  table: dynamodb.Table;
  ssmParamArns: string[];
  telegramTestMode?: boolean;
  paypalBaseUrl?: string;
  envName: string;
}

interface LambdaWithAlias {
  fn: lambda.NodejsFunction;
  alias: lambdaBase.Alias;
  alarm: cloudwatch.Alarm;
  deploymentGroup: codedeploy.LambdaDeploymentGroup;
}

export class BlueGreenWebhooks extends Construct {
  public readonly api: apigwv2.HttpApi;
  public readonly telegramUrl: string;
  public readonly stripeUrl: string;
  public readonly paypalUrl: string;

  constructor(scope: Construct, id: string, props: BlueGreenWebhooksProps) {
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

    // Create HTTP API for webhooks
    this.api = new apigwv2.HttpApi(this, 'WebhookApi', {
      apiName: `dale-webhooks-${props.envName}`,
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.POST],
        allowHeaders: ['Content-Type', 'X-Telegram-Bot-Api-Secret-Token', 'Stripe-Signature'],
      },
    });

    // CodeDeploy application for all webhook lambdas
    const application = new codedeploy.LambdaApplication(this, 'DeployApp', {
      applicationName: `dale-webhooks-${props.envName}`,
    });

    // Create Telegram handler with blue/green
    const telegram = this.createBlueGreenLambda('Telegram', {
      entry: path.join(__dirname, '../../../src/telegram/webhook.ts'),
      environment: commonEnv,
      bundling: { ...bundling, nodeModules: ['ulid'] },
      application,
      table: props.table,
      ssmParamArns: props.ssmParamArns,
    });

    // Create Stripe handler with blue/green
    const stripe = this.createBlueGreenLambda('Stripe', {
      entry: path.join(__dirname, '../../../src/stripe/webhook.ts'),
      environment: commonEnv,
      bundling: { ...bundling, nodeModules: ['stripe'] },
      application,
      table: props.table,
      ssmParamArns: props.ssmParamArns,
    });

    // Create PayPal handler with blue/green
    const paypal = this.createBlueGreenLambda('PayPal', {
      entry: path.join(__dirname, '../../../src/paypal/webhook.ts'),
      environment: {
        ...commonEnv,
        PAYPAL_BASE_URL: props.paypalBaseUrl ?? 'https://api-m.paypal.com',
      },
      bundling,
      application,
      table: props.table,
      ssmParamArns: props.ssmParamArns,
    });

    // Add routes using aliases
    this.api.addRoutes({
      path: '/telegram',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('TelegramIntegration', telegram.alias),
    });

    this.api.addRoutes({
      path: '/stripe',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('StripeIntegration', stripe.alias),
    });

    this.api.addRoutes({
      path: '/paypal',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('PayPalIntegration', paypal.alias),
    });

    // Construct URLs
    this.telegramUrl = `${this.api.apiEndpoint}/telegram`;
    this.stripeUrl = `${this.api.apiEndpoint}/stripe`;
    this.paypalUrl = `${this.api.apiEndpoint}/paypal`;
  }

  private createBlueGreenLambda(
    name: string,
    opts: {
      entry: string;
      environment: Record<string, string>;
      bundling: lambda.BundlingOptions;
      application: codedeploy.LambdaApplication;
      table: dynamodb.Table;
      ssmParamArns: string[];
    },
  ): LambdaWithAlias {
    const fn = new lambda.NodejsFunction(this, `${name}Handler`, {
      runtime: lambdaBase.Runtime.NODEJS_20_X,
      architecture: lambdaBase.Architecture.ARM_64,
      entry: opts.entry,
      handler: 'handler',
      environment: opts.environment,
      bundling: opts.bundling,
      timeout: cdk.Duration.seconds(15),
      currentVersionOptions: {
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      },
    });

    opts.table.grantReadWriteData(fn);

    const ssmPolicy = new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParametersByPath'],
      resources: opts.ssmParamArns,
    });
    fn.addToRolePolicy(ssmPolicy);

    // Create alias pointing to current version
    const alias = new lambdaBase.Alias(this, `${name}Alias`, {
      aliasName: 'live',
      version: fn.currentVersion,
    });

    // CloudWatch alarm for auto-rollback on errors
    const alarm = new cloudwatch.Alarm(this, `${name}5xx`, {
      metric: alias.metricErrors({ period: cdk.Duration.minutes(1) }),
      threshold: 5,
      evaluationPeriods: 1,
    });

    // Create CodeDeploy deployment group with ALL_AT_ONCE and alarm-based rollback
    const deploymentGroup = new codedeploy.LambdaDeploymentGroup(this, `${name}DeploymentGroup`, {
      application: opts.application,
      alias,
      deploymentConfig: codedeploy.LambdaDeploymentConfig.ALL_AT_ONCE,
      alarms: [alarm],
      autoRollback: {
        failedDeployment: true,
        stoppedDeployment: true,
        deploymentInAlarm: true,
      },
    });

    return { fn, alias, alarm, deploymentGroup };
  }
}
