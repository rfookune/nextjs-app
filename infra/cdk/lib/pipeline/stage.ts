import { StageProps, Stage } from "aws-cdk-lib";
import {
  DatabaseClusterEngine, 
  AuroraPostgresEngineVersion,
} from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";

import { DatabaseUserProps, DatabaseStack } from "../stacks/database";
import { NetworkStackProps, NetworkStack } from "../stacks/network";
import { HostClusterStack, HostClusterUserProps } from "../stacks/hostcluster";
import { RoutingStack, RoutingUserProps } from "../stacks/routing";
import { MigratorStack, MigratorUserProps } from "../stacks/migrator";


export interface DefaultStageProps extends StageProps {
  routingProps: RoutingUserProps;
  networkProps: NetworkStackProps;
  databaseProps: DatabaseUserProps;
  migratorProps: MigratorUserProps;
  hostClusterProps: HostClusterUserProps;
}

export class DefaultStage extends Stage {
  constructor(scope: Construct, id: string, props: DefaultStageProps) {
    super(scope, id, props);

    const { routingProps, networkProps, databaseProps, migratorProps, hostClusterProps } = props;

    const network = new NetworkStack(
      this,
      `${networkProps.applicationName}Network`,
      {
        maxAzs: networkProps.maxAzs,
        databasePort: databaseProps.port,
        natGateways: networkProps.natGateways,
        applicationName: networkProps.applicationName,
      }
    );
    const database = new DatabaseStack(
      this,
      `${networkProps.applicationName}Database`,
      {
        vpc: network.vpc,
        subnetGroup: network.dbSubnetGroup,
        securityGroup: network.dbSecurityGroup,
        engine: DatabaseClusterEngine.auroraPostgres({
          version: AuroraPostgresEngineVersion.VER_15_5,
        }),
        ...databaseProps,
      }
    );

    const port = database.databaseCluster.clusterEndpoint.port;
    const host = database.databaseCluster.clusterEndpoint.hostname;
    const username = database.databaseCluster.secret!.secretValueFromJson('username').unsafeUnwrap();
    const password = database.databaseCluster.secret!.secretValueFromJson('password').unsafeUnwrap();
    const databaseName = database.databaseCluster.secret!.secretValueFromJson('dbname').unsafeUnwrap();
    const databaseUrl = `postgresql://${username}:${password}@${host}:${port}/${databaseName}?schema=public`;
    const environment = {
      DATABASE_URL: databaseUrl,
    };

    new MigratorStack(this, `${networkProps.applicationName}MigratorLambda`, {
      environment,
      vpc: network.vpc,
      securityGroup: network.webSecurityGroup,
      databaseCluster: database.databaseCluster,
      ...migratorProps,
    });

    const hostCluster = new HostClusterStack(
      this,
      `${networkProps.applicationName}HostCluster`,
      {
        environment,
        vpc: network.vpc,
        securityGroup: network.webSecurityGroup,
        databaseCluster: database.databaseCluster,
        ...hostClusterProps,
      }
    );

    new RoutingStack(
      this,
      `${networkProps.applicationName}Routing`,
      {
        ...routingProps,
        vpc: network.vpc,
        service: hostCluster.service,
        securityGroup: network.webSecurityGroup,
      }
    );
  }
}
