import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Runtime, Architecture } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AutoShutdownProps {
  /** HTTP API ID (ApiGatewayV2) to monitor for inactivity */
  apiId: string;
  /** Minutes of zero traffic before shutdown. Default: 30 */
  idleMinutes?: number;
}

/**
 * Auto-shuts down the dev stack after a configurable idle period.
 *
 * Monitors the HTTP API's request count via CloudWatch.
 * When the count drops to 0 for `idleMinutes`, a Lambda deletes the stack.
 *
 * DynamoDB + Cognito User Pool are retained (RemovalPolicy.RETAIN) so data
 * survives deletion. Re-deploy to bring the environment back up.
 */
export class AutoShutdown extends Construct {
  constructor(scope: Construct, id: string, props: AutoShutdownProps) {
    super(scope, id);

    const stack = cdk.Stack.of(this);
    const idleMinutes = props.idleMinutes ?? 30;

    // Use 15-min evaluation windows
    const periodMinutes = 15;
    const evaluationPeriods = Math.ceil(idleMinutes / periodMinutes);

    // SNS topic — alarm fires here, Lambda subscribes
    const alarmTopic = new sns.Topic(this, 'ShutdownTopic', {
      displayName: `${stack.stackName} auto-shutdown`,
    });

    // Lambda that deletes the stack on alarm
    const shutdownFn = new lambda.NodejsFunction(this, 'ShutdownFn', {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      entry: path.join(__dirname, '../../../src/shutdown/handler.ts'),
      handler: 'handler',
      environment: {
        STACK_NAME: stack.stackName,
      },
      timeout: cdk.Duration.seconds(30),
      bundling: {
        externalModules: ['@aws-sdk/*'],
        format: lambda.OutputFormat.ESM,
        target: 'node20',
      },
    });

    // Allow Lambda to initiate stack deletion
    // CloudFormation uses its own execution role to delete the actual resources
    shutdownFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudformation:DeleteStack'],
      resources: [stack.stackId],
    }));

    alarmTopic.addSubscription(new snsSubscriptions.LambdaSubscription(shutdownFn));

    // CloudWatch alarm: HTTP API request count < 1 for N consecutive 15-min windows
    const idleAlarm = new cloudwatch.Alarm(this, 'IdleAlarm', {
      alarmName: `${stack.stackName}-idle-shutdown`,
      alarmDescription: `Auto-shutdown ${stack.stackName} after ${idleMinutes}min of no API traffic`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGatewayV2',
        metricName: 'Count',
        dimensionsMap: { ApiId: props.apiId },
        period: cdk.Duration.minutes(periodMinutes),
        statistic: 'Sum',
      }),
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods,
      // NOT_BREACHING: missing data points (no API Gateway metrics at all) don't trigger shutdown.
      // The alarm only fires when the API has *had* traffic that then drops to zero.
      // This prevents immediate self-deletion on fresh deploys with no traffic yet.
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    idleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));

    // Emit the alarm name for visibility
    new cdk.CfnOutput(this, 'IdleAlarmName', {
      value: idleAlarm.alarmName,
      description: `Fires after ${idleMinutes}min idle → deletes this dev stack`,
    });
  }
}
