import { App } from "aws-cdk-lib";
import * as dotenv from "dotenv";
import * as path from "path";

import { PipelineStack } from "../lib/pipeline/pipeline";


dotenv.config({ 
  path: path.resolve(__dirname, "../.env"),
});

const hostPort = parseInt(process.env.HOST_PORT!);
const applicationName = process.env.APPLICATION_NAME!;
const databasePort = parseInt(process.env.DATABASE_PORT!);
const env = {
  account: process.env.AWS_ACCOUNT_ID!,
  region: process.env.AWS_REGION!,
};

const app = new App();
new PipelineStack(
  app,
  `${applicationName}PipelineStack`,
  {
    env,
    applicationName,
    repoSlug: process.env.REPOSITORY_SLUG!,
    repoBranch: process.env.REPOSITORY_BRANCH!,
    connectionArn: process.env.CONNECTION_ARN!,
    routingProps: {
      hostPort,
      containerName: process.env.SERVICE_NAME!,
      certificateArn: process.env.CERTIFICATE_ARN!,
    },
    networkProps: {
      databasePort,
      applicationName,
      maxAzs: parseInt(process.env.MAX_AZS!),
      natGateways: parseInt(process.env.NAT_GATEWAYS!),
    },
    databaseProps: {
      port: databasePort,
      name: process.env.DATABASE_NAME!,
      username: process.env.DATABASE_USERNAME!,
      engineName: process.env.DATABASE_ENGINE_NAME!,
      clusterMinCapacity: parseFloat(process.env.DATABASE_CLUSTER_MIN_CAPACITY!),
      clusterMaxCapacity: parseFloat(process.env.DATABASE_CLUSTER_MAX_CAPACITY!),
    },
    migratorProps: {
      applicationName,
      sourceRoot: process.env.SOURCE_ROOT!,
      dockerfileName: process.env.MIGRATOR_DOCKERFILE_NAME!,
    },
    hostClusterProps: {
      hostPort,
      sourceRoot: process.env.SOURCE_ROOT!,
      serviceName: process.env.SERVICE_NAME!,
      containerName: process.env.SERVICE_NAME!,
      dockerfileName: process.env.DOCKERFILE_NAME!,
      minCapacity: parseInt(process.env.HOST_MIN_CAPACITY!),
      maxCapacity: parseInt(process.env.HOST_MAX_CAPACITY!),
    },
  }
);

app.synth();
