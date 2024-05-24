import { StackProps, Stack, Duration } from "aws-cdk-lib";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { IVpc, SecurityGroup, SubnetType } from "aws-cdk-lib/aws-ec2";
import { Ec2Service, Protocol } from "aws-cdk-lib/aws-ecs";
import { 
  ApplicationListener,
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  SslPolicy,
  TargetType,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";


export interface RoutingUserProps {
  hostPort: number;
  containerName: string;
  certificateArn: string;
}

export interface RoutingStackProps extends RoutingUserProps, StackProps {
  vpc: IVpc;
  service: Ec2Service;
  securityGroup: SecurityGroup;
}

export class RoutingStack extends Stack {
  constructor(scope: Construct, id: string, props: RoutingStackProps) {
    super(scope, id, props);

    const { containerName, securityGroup, vpc } = props;

    const certificate = Certificate.fromCertificateArn(this, "Certificate", props.certificateArn);

    const loadBalancer = new ApplicationLoadBalancer(this, "LoadBalancer", {
      vpc,
      securityGroup,
      internetFacing: true,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
      },
    });

    const targetGroup = new ApplicationTargetGroup(this, "TargetGroup", {
      vpc,
      port: props.hostPort,
      targetType: TargetType.INSTANCE,
      protocol: ApplicationProtocol.HTTP,
      targetGroupName: `${containerName.toLocaleLowerCase()}-target-group`,
      targets: [
        props.service.loadBalancerTarget({
          containerName,
          protocol: Protocol.TCP,
          containerPort: props.hostPort,
        }),
      ],
      healthCheck: {
        path: "/",
        timeout: Duration.seconds(5),
        interval: Duration.seconds(60),
      },
    });

    new ApplicationListener(this, "PublicListener", {
      port: 443,
      open: true,
      loadBalancer,
      protocol: ApplicationProtocol.HTTPS,
      sslPolicy: SslPolicy.RECOMMENDED_TLS,
      certificates: [
        certificate,
      ],
      defaultTargetGroups: [
        targetGroup,
      ],
    });
  }
}
