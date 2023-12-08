import { Construct } from 'constructs';
import { HttpMethod } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'

export class RenderTestApiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // API Gateway for HTTP API
        const appGateway = new apigwv2.HttpApi(this, 'RenderTestApi', {
            description: 'API for RenderTestService'
        });

        // Hello world lambda
        const helloLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'hello', {
            description: 'Hello world api',
            runtime: lambda.Runtime.NODEJS_18_X
        });

        appGateway.addRoutes({
            integration: new HttpLambdaIntegration(`hello-integration`, helloLambda),
            path: '/hello',
            methods: [HttpMethod.GET]
        });
    }
}