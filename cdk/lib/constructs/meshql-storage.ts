import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface MeshqlStorageProps {
  retainData: boolean;
  envName: string;
}

export class MeshqlStorage extends Construct {
  public readonly meshqlUrl: string;
  public readonly meshqlLambda: lambda.Function;
  public readonly vpc: ec2.Vpc;
  public readonly fileSystem: efs.FileSystem;
  public readonly accessPoint: efs.AccessPoint;

  constructor(scope: Construct, id: string, props: MeshqlStorageProps) {
    super(scope, id);

    // VPC for EFS and Lambda — private subnets, no NAT Gateway.
    // MeshQL (restlette/graphlette) is a pure data store: no outbound internet calls.
    // EFS mounts work entirely within the VPC. NAT = wasted $32/month.
    // Keep subnet name 'Private' (same logical ID) to avoid CIDR conflicts on update.
    // Remove Public subnets + NAT — CloudFormation deletes them cleanly.
    this.vpc = new ec2.Vpc(this, 'MeshqlVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // EFS file system for merkql event storage
    this.fileSystem = new efs.FileSystem(this, 'MeshqlEfs', {
      vpc: this.vpc,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      removalPolicy: props.retainData ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      encrypted: true,
    });

    // Access point for Lambda
    this.accessPoint = this.fileSystem.addAccessPoint('LambdaAccessPoint', {
      path: '/meshql',
      createAcl: {
        ownerUid: '1001',
        ownerGid: '1001',
        permissions: '755',
      },
      posixUser: {
        uid: '1001',
        gid: '1001',
      },
    });

    // meshql-rs Lambda (ARM64 Rust)
    this.meshqlLambda = new lambda.Function(this, 'MeshqlHandler', {
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend'), {
        bundling: {
          // Local bundling: use pre-built binary if available (CI builds it before synth/deploy)
          local: {
            tryBundle(outputDir: string): boolean {
              const src = path.join(__dirname, '../../../backend/target/release/dale-backend');
              if (fs.existsSync(src)) {
                fs.copyFileSync(src, path.join(outputDir, 'bootstrap'));
                fs.chmodSync(path.join(outputDir, 'bootstrap'), 0o755);
                return true;
              }
              return false; // fall back to Docker
            },
          },
          image: cdk.DockerImage.fromRegistry('ghcr.io/cargo-lambda/cargo-lambda:latest'),
          command: [
            'bash', '-c',
            'cargo lambda build --release --arm64 && cp target/lambda/meshql-rs/bootstrap /asset-output/',
          ],
          user: 'root',
        },
      }),
      environment: {
        EFS_MOUNT_PATH: '/mnt/meshql',
        RUST_LOG: 'info',
      },
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      filesystem: lambda.FileSystem.fromEfsAccessPoint(this.accessPoint, '/mnt/meshql'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // Add Function URL for meshql-rs
    const fnUrl = this.meshqlLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    this.meshqlUrl = fnUrl.url;
  }
}
