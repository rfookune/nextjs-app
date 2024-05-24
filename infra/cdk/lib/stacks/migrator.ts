import { StackProps, Stack, Duration, IgnoreMode, CfnOutput } from "aws-cdk-lib";
import { Vpc, SecurityGroup } from "aws-cdk-lib/aws-ec2";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import { Architecture, DockerImageCode, DockerImageFunction } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { DatabaseCluster } from "aws-cdk-lib/aws-rds";
import { Trigger } from "aws-cdk-lib/triggers";
import { Construct } from "constructs";


export interface MigratorUserProps {
  sourceRoot: string;
  dockerfileName: string;
  applicationName: string;
}

export interface MigratorStackProps extends MigratorUserProps, StackProps {
  vpc: Vpc;
  sourceRoot: string;
  securityGroup: SecurityGroup;
  databaseCluster: DatabaseCluster;
  environment?: { [key: string]: string };
}

export class MigratorStack extends Stack {
  migrationLambda: DockerImageFunction;

  constructor(scope: Construct, id: string, props: MigratorStackProps) {
    super(scope, id, props);

    const { applicationName, databaseCluster, dockerfileName, environment, securityGroup, sourceRoot, vpc } = props;

    this.migrationLambda = new DockerImageFunction(this, 'PrismaMigrationLambda', {
      vpc,
      environment,
      memorySize: 256,
      // Note that the timeout in is minutes to avoid the lambda timing out during a migration.
      timeout: Duration.minutes(2),
      architecture: Architecture.ARM_64,
      logRetention: RetentionDays.ONE_DAY,
      functionName: `${applicationName}MigrationLambda`,
      securityGroups: [
        securityGroup
      ],
      code: DockerImageCode.fromImageAsset(sourceRoot, { 
        file: dockerfileName,
        ignoreMode: IgnoreMode.GIT,
        platform: Platform.LINUX_ARM64,
        exclude: [
          '.git',
          'pgdata',
          'cdk.out',
          'node_modules',
        ],
      }),
    });

    databaseCluster.grantConnect(
      this.migrationLambda,
      databaseCluster.secret!.secretValueFromJson('username').unsafeUnwrap(),
    );

    // Run database migration during CDK deployment. This is the only time the lambda will be triggered.
    const trigger = new Trigger(this, 'PrismaMigrationTrigger', {
      handler: this.migrationLambda,
    });
    
    // Make sure migration is executed after the database cluster is available.
    trigger.node.addDependency(databaseCluster);

    new CfnOutput(
      this,
      `${applicationName}MigrationLambdaArn`,
      {
        value: this.migrationLambda.functionArn,
        description: `The ARN of the PrismaMigration lambda function`,
      }
    );
  }
}
