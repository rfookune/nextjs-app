import { StackProps, Stack, pipelines, Environment } from 'aws-cdk-lib';
import { LinuxArmBuildImage } from 'aws-cdk-lib/aws-codebuild';
import { CodePipeline, ShellStep } from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';

import { DatabaseUserProps } from '../stacks/database';
import { NetworkStackProps } from '../stacks/network';
import { DefaultStage } from './stage';
import { HostClusterUserProps } from '../stacks/hostcluster';
import { RoutingUserProps } from '../stacks/routing';
import { MigratorUserProps } from '../stacks/migrator';


export interface PipelineStackProps extends StackProps {
  env: Environment;
  repoSlug: string;
  repoBranch: string;
  connectionArn: string;
  applicationName: string;
  routingProps: RoutingUserProps;
  networkProps: NetworkStackProps;
  databaseProps: DatabaseUserProps;
  migratorProps: MigratorUserProps;
  hostClusterProps: HostClusterUserProps;
}

export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const {
      env,
      repoSlug,
      repoBranch,
      connectionArn,
      applicationName,
      routingProps,
      networkProps,
      hostClusterProps,
      databaseProps,
      migratorProps,
    } = props;

    const pipeline = new CodePipeline(
      this,
      `${applicationName}Pipeline`,
      {
        crossAccountKeys: false,
        selfMutation: true,
        publishAssetsInParallel: false,
        dockerEnabledForSynth: true,
        pipelineName: `${applicationName}Pipeline`,
        assetPublishingCodeBuildDefaults: {
          buildEnvironment: {
            buildImage: LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
          },
        },
        synth: new ShellStep(
          'Synth',
          {
            input: pipelines.CodePipelineSource.connection(
              repoSlug,
              repoBranch,
              {
                triggerOnPush: true,
                connectionArn: connectionArn,
              }
            ),
            installCommands: [
              'npm install -g aws-cdk',
              'npm update',
            ],
            commands: [
              'cd infra/cdk',
              'npm install',
              'cdk synth'
            ],
            primaryOutputDirectory: 'infra/cdk/cdk.out'
          }),
      }
    );
    pipeline.addStage(new DefaultStage(
      this,
      'Prod',
      {
        env,
        routingProps,
        networkProps,
        databaseProps,
        migratorProps,
        hostClusterProps,
      }),
    );
  }
}
