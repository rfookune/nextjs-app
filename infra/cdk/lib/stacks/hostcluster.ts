import { StackProps, Stack, IgnoreMode } from "aws-cdk-lib";
import { 
  IVpc, 
  InstanceClass, 
  InstanceSize, 
  InstanceType, 
  SecurityGroup,
  SubnetType,
} from "aws-cdk-lib/aws-ec2";
import {
  AmiHardwareType,
  Cluster,
  ContainerImage,
  Ec2Service,
  Ec2TaskDefinition,
  EcsOptimizedImage,
  LogDrivers,
  NetworkMode,
} from "aws-cdk-lib/aws-ecs";
import { ManagedPolicy } from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { DatabaseCluster } from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";


export interface HostClusterUserProps {
  hostPort: number;
  sourceRoot: string;
  minCapacity: number;
  maxCapacity: number;
  serviceName: string;
  containerName: string;
  dockerfileName: string;
}

export interface HostClusterStackProps extends HostClusterUserProps, StackProps {
  vpc: IVpc;
  securityGroup: SecurityGroup;
  databaseCluster: DatabaseCluster;
  environment?: { [key: string]: string };
}

export class HostClusterStack extends Stack {
  service: Ec2Service;

  constructor(scope: Construct, id: string, props: HostClusterStackProps) {
    super(scope, id, props);

    const { 
      vpc, 
      securityGroup, 
      databaseCluster, 
      hostPort, 
      sourceRoot, 
      minCapacity, 
      maxCapacity, 
      serviceName, 
      containerName, 
      dockerfileName, 
      environment,
    } = props;

    const cluster = new Cluster(this, `${props.serviceName}Cluster`, {
      vpc,
    });

    const autoScalingGroup = cluster.addCapacity(`${props.serviceName}ClusterCapacity`, {
      minCapacity,
      maxCapacity,
      machineImage: EcsOptimizedImage.amazonLinux2023(AmiHardwareType.ARM),
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
      instanceType: InstanceType.of(
        InstanceClass.T4G,
        InstanceSize.MICRO,
      ),
    });
    autoScalingGroup.addSecurityGroup(securityGroup);

    const taskDefinition = new Ec2TaskDefinition(this, `${props.serviceName}TaskDefinition`, {
      networkMode: NetworkMode.BRIDGE,
    });

    taskDefinition.addContainer(`${props.serviceName}Container`, {
      environment: environment,
      containerName: containerName,
      // Memory soft limit. Bump the memory reservation to avoid OOM errors. Note that you'll need to change the
      // instance size if you bump this too high.
      memoryReservationMiB: 512,
      logging: LogDrivers.awsLogs({ 
        logRetention: RetentionDays.ONE_WEEK,
        streamPrefix: props.containerName.toLocaleLowerCase(),
      }),
      portMappings: [
        {
          hostPort: hostPort,
          containerPort: hostPort,
        },
      ],
      image: ContainerImage.fromAsset(sourceRoot, {
        file: dockerfileName,
        ignoreMode: IgnoreMode.GIT,
        exclude: [
          '.git',
          'cdk.out',
          'node_modules',
        ],
      }),
    });

    this.service = new Ec2Service(this, `${props.serviceName}Service`, {
      cluster,
      serviceName,
      taskDefinition,
      desiredCount: minCapacity,
    });
    this.service.node.addDependency(autoScalingGroup);

    databaseCluster.secret!.grantRead(taskDefinition.taskRole);
    taskDefinition.taskRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite')
    );
    taskDefinition.taskRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role')
    );
    databaseCluster.grantConnect(
      this.service.taskDefinition.executionRole!,
      databaseCluster.secret!.secretValueFromJson('username').unsafeUnwrap(),
    );
  }
}
