import { StackProps, Stack } from 'aws-cdk-lib';
import { Vpc, SubnetType, SecurityGroup, Port } from 'aws-cdk-lib/aws-ec2';
import { SubnetGroup } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';


export interface NetworkStackProps extends StackProps {
  applicationName: string;
  databasePort: number;
  maxAzs?: number;
  natGateways?: number;
}

export class NetworkStack extends Stack {
  vpc: Vpc;
  dbSubnetGroup: SubnetGroup;
  dbSecurityGroup: SecurityGroup;
  webSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { applicationName, databasePort, maxAzs, natGateways } = props;

    this.vpc = new Vpc(
      this,
      `${applicationName}VPC`,
      {
        maxAzs: maxAzs || 3,
        natGateways: natGateways || 1,
        subnetConfiguration: [
          {
            name: 'public',
            subnetType: SubnetType.PUBLIC,
          },
          {
            name: 'private-isolated',
            subnetType: SubnetType.PRIVATE_ISOLATED,
          },
          {
            name: 'private-with-egress',
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          },
        ],
      }
    );
    this.webSecurityGroup = new SecurityGroup(
      this,
      `${applicationName}WebSecurityGroup`,
      {
        vpc: this.vpc,
        allowAllOutbound: true,
        description: 'Security group for web instances or lambda functions',
      }
    );
    this.dbSecurityGroup = new SecurityGroup(
      this,
      `${applicationName}DbSecurityGroup`,
      {
        vpc: this.vpc,
        allowAllOutbound: false,
        description: 'Security group for RDS database instances',
      }
    );
    this.dbSecurityGroup.addIngressRule(
      this.webSecurityGroup,
      Port.tcp(databasePort),
      'Allow web security group to connect to the database',
    );

    this.dbSubnetGroup = new SubnetGroup(
      this,
      `${applicationName}DbSubnetGroup`,
      {
        vpc: this.vpc,
        description: 'Isolated subnet group for the database cluster',
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      }
    );
  }
}
