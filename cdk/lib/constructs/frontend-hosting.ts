import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface FrontendApp {
  /** Name of the app (e.g., 'consumer', 'creator', 'admin') */
  name: string;
  /** Custom domain for this app (e.g., 'dalegram.com', 'creators.dalegram.com') */
  domainName?: string;
}

export interface FrontendHostingProps {
  envName: string;
  apps: FrontendApp[];
  /** ARN of an ACM certificate (must be in us-east-1) covering all custom domains */
  certificateArn?: string;
}

export interface FrontendDeployment {
  bucket: s3.Bucket;
  distribution: cloudfront.Distribution;
  siteUrl: string;
}

export class FrontendHosting extends Construct {
  public readonly deployments: Map<string, FrontendDeployment> = new Map();

  constructor(scope: Construct, id: string, props: FrontendHostingProps) {
    super(scope, id);

    const certificate = props.certificateArn
      ? acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn)
      : undefined;

    for (const app of props.apps) {
      const titleCase = app.name.charAt(0).toUpperCase() + app.name.slice(1);

      const bucket = new s3.Bucket(this, `${titleCase}Bucket`, {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });

      const domainNames = app.domainName && certificate
        ? [app.domainName]
        : undefined;

      const distribution = new cloudfront.Distribution(this, `${titleCase}Distribution`, {
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        defaultRootObject: 'index.html',
        domainNames,
        certificate: domainNames ? certificate : undefined,
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.minutes(5),
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.minutes(5),
          },
        ],
      });

      const siteUrl = app.domainName
        ? `https://${app.domainName}`
        : `https://${distribution.distributionDomainName}`;

      this.deployments.set(app.name, {
        bucket,
        distribution,
        siteUrl,
      });
    }
  }
}
