import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MeshqlStorage } from './constructs/meshql-storage.js';
import { Webhooks } from './constructs/webhooks.js';
import { BlueGreenWebhooks } from './constructs/blue-green-webhooks.js';
import { AdminApi } from './constructs/admin-api.js';
import { WebHosting } from './constructs/web-hosting.js';
import { FrontendHosting } from './constructs/frontend-hosting.js';
import { AutoShutdown } from './constructs/auto-shutdown.js';

export interface DaleStackProps extends cdk.StackProps {
  envName: string;
  retainData: boolean;
  telegramTestMode?: boolean;
  paypalBaseUrl?: string;
  blueGreenDeployment?: boolean;
}

export class DaleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DaleStackProps) {
    super(scope, id, props);

    // MeshQL Storage (EFS + meshql-rs Lambda)
    const storage = new MeshqlStorage(this, 'MeshqlStorage', {
      retainData: props.retainData,
      envName: props.envName,
    });

    // Webhook URLs (set differently based on deployment type)
    let telegramWebhookUrl: string;
    let stripeWebhookUrl: string;
    let paypalWebhookUrl: string;

    // Webhook Lambdas - use blue/green for prod, function URLs for dev
    if (props.blueGreenDeployment) {
      const blueGreenWebhooks = new BlueGreenWebhooks(this, 'BlueGreenWebhooks', {
        meshqlUrl: storage.meshqlUrl,
        telegramTestMode: props.telegramTestMode,
        paypalBaseUrl: props.paypalBaseUrl,
        envName: props.envName,
      });
      telegramWebhookUrl = blueGreenWebhooks.telegramUrl;
      stripeWebhookUrl = blueGreenWebhooks.stripeUrl;
      paypalWebhookUrl = blueGreenWebhooks.paypalUrl;
    } else {
      const webhooks = new Webhooks(this, 'Webhooks', {
        meshqlUrl: storage.meshqlUrl,
        telegramTestMode: props.telegramTestMode,
        paypalBaseUrl: props.paypalBaseUrl,
      });
      telegramWebhookUrl = webhooks.telegramUrl.url;
      stripeWebhookUrl = webhooks.stripeUrl.url;
      paypalWebhookUrl = webhooks.paypalUrl.url;
    }

    // Web Hosting (S3 + CloudFront) — before AdminApi so CloudFront domain is available
    // Set DOMAIN_NAME + CERTIFICATE_ARN env vars to enable a custom domain (e.g. dalegram.com).
    const webHosting = new WebHosting(this, 'WebHosting', {
      envName: props.envName,
      domainName: process.env.DOMAIN_NAME,
      certificateArn: process.env.CERTIFICATE_ARN,
    });

    const cloudFrontUrl = `https://${webHosting.distribution.distributionDomainName}`;
    // siteUrl is the custom domain if configured, CloudFront domain otherwise
    const siteUrl = webHosting.siteUrl;

    // Admin API (Cognito + API Gateway + Lambda)
    const adminApi = new AdminApi(this, 'AdminApi', {
      meshqlUrl: storage.meshqlUrl,
      telegramTestMode: props.telegramTestMode,
      telegramWebhookUrl,
      stripeWebhookUrl,
      paypalWebhookUrl,
      paypalBaseUrl: props.paypalBaseUrl,
      envName: props.envName,
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
      appleClientId: process.env.APPLE_CLIENT_ID,
      appleTeamId: process.env.APPLE_TEAM_ID,
      appleKeyId: process.env.APPLE_KEY_ID,
      applePrivateKey: process.env.APPLE_PRIVATE_KEY,
      callbackUrls: process.env.CALLBACK_URLS?.split(',') ?? [`${siteUrl}/callback`, 'http://localhost:5173/callback'],
      logoutUrls: process.env.LOGOUT_URLS?.split(',') ?? [siteUrl, 'http://localhost:5173/'],
    });

    // Auto-shutdown: destroy dev stack after 30min of inactivity (saves ~$33/month NAT costs)
    // Not applied to prod (retainData=true acts as a proxy for "is prod")
    if (!props.retainData) {
      new AutoShutdown(this, 'AutoShutdown', {
        apiId: adminApi.api.apiId,
        idleMinutes: 30,
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'TelegramWebhookUrl', {
      value: telegramWebhookUrl,
    });

    new cdk.CfnOutput(this, 'StripeWebhookUrl', {
      value: stripeWebhookUrl,
    });

    new cdk.CfnOutput(this, 'PayPalWebhookUrl', {
      value: paypalWebhookUrl,
    });

    new cdk.CfnOutput(this, 'AdminApiUrl', {
      value: adminApi.api.apiEndpoint,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: adminApi.userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: adminApi.userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'WebDistributionUrl', {
      value: cloudFrontUrl,
    });

    // CloudFront domain — CNAME dalegram.com → this value
    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: webHosting.distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, 'SiteUrl', {
      value: siteUrl,
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: `dale-${props.envName}-${this.account}`,
    });

    new cdk.CfnOutput(this, 'WebBucketName', {
      value: webHosting.bucket.bucketName,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: webHosting.distribution.distributionId,
    });

    new cdk.CfnOutput(this, 'MeshqlUrl', {
      value: storage.meshqlUrl,
    });

    // Frontend Hosting (Consumer, Creator, Admin apps)
    const frontendHosting = new FrontendHosting(this, 'FrontendHosting', {
      envName: props.envName,
      apps: [
        {
          name: 'consumer',
          domainName: process.env.CONSUMER_DOMAIN,
        },
        {
          name: 'creator',
          domainName: process.env.CREATOR_DOMAIN,
        },
        {
          name: 'admin',
          domainName: process.env.ADMIN_DOMAIN,
        },
      ],
      certificateArn: process.env.CERTIFICATE_ARN,
    });

    // Consumer app outputs
    const consumerDeployment = frontendHosting.deployments.get('consumer')!;
    new cdk.CfnOutput(this, 'ConsumerBucketName', {
      value: consumerDeployment.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'ConsumerDistributionId', {
      value: consumerDeployment.distribution.distributionId,
    });
    new cdk.CfnOutput(this, 'ConsumerSiteUrl', {
      value: consumerDeployment.siteUrl,
    });

    // Creator app outputs
    const creatorDeployment = frontendHosting.deployments.get('creator')!;
    new cdk.CfnOutput(this, 'CreatorBucketName', {
      value: creatorDeployment.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'CreatorDistributionId', {
      value: creatorDeployment.distribution.distributionId,
    });
    new cdk.CfnOutput(this, 'CreatorSiteUrl', {
      value: creatorDeployment.siteUrl,
    });

    // Admin app outputs
    const adminDeployment = frontendHosting.deployments.get('admin')!;
    new cdk.CfnOutput(this, 'AdminBucketName', {
      value: adminDeployment.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'AdminDistributionId', {
      value: adminDeployment.distribution.distributionId,
    });
    new cdk.CfnOutput(this, 'AdminSiteUrl', {
      value: adminDeployment.siteUrl,
    });
  }
}
