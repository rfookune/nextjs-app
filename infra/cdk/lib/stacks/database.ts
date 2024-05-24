import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import { SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { 
  ClusterInstance,
  Credentials,
  DatabaseCluster,
  IClusterEngine,
  SubnetGroup,
} from "aws-cdk-lib/aws-rds";


export interface DatabaseUserProps {
  name: string;
  port: number;
  username: string;
  engineName?: string;
  clusterMinCapacity?: number;
  clusterMaxCapacity?: number;
}

export interface DatabaseStackProps extends DatabaseUserProps, StackProps {
  vpc: Vpc;
  engine: IClusterEngine;
  subnetGroup: SubnetGroup;
  securityGroup: SecurityGroup;
}

export class DatabaseStack extends Stack {
  databaseCluster: DatabaseCluster;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { 
      vpc,
      name,
      port,
      engine,
      username,
      subnetGroup,
      securityGroup,
      clusterMinCapacity,
      clusterMaxCapacity,
    } = props;

    this.databaseCluster = new DatabaseCluster(
      this,
      `${name}Database`,
      {
        vpc: vpc,
        port: port,
        engine: engine,
        storageEncrypted: true,
        iamAuthentication: true,
        subnetGroup: subnetGroup,
        defaultDatabaseName: name,
        serverlessV2MinCapacity: clusterMinCapacity || 0.5,
        serverlessV2MaxCapacity: clusterMaxCapacity || 2,
        credentials: Credentials.fromUsername(username),
        writer: ClusterInstance.serverlessV2("reader-writer"),
        securityGroups: [
          securityGroup
        ],
      },
    );
  }
}
