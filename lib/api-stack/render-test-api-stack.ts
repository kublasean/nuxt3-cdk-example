import { Construct } from 'constructs';

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';

import * as fs from 'fs';
import * as path from 'path';
import { SpecRestApi } from 'aws-cdk-lib/aws-apigateway';
import { SmithyApiDefinition, SmithySubstitution } from './smithy-apidefinition';
import { SmithyLambdaIntegration } from './smithy-integration';

export class RenderTestApiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Hello world lambda
        const helloLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'hello', {
            description: 'Hello world api',
            runtime: lambda.Runtime.NODEJS_18_X
        });

        const modelJson = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', '..', 'smithy', 'build', 'smithy', 
                'openapi-conversion', 'openapi', 'RenderTest.openapi.json'), 'utf-8'));

        const helloLambdaIntegration = new SmithyLambdaIntegration(helloLambda, {
            allowTestInvoke: true
        });

        const api = new SpecRestApi(this, 'helloApi', {
            apiDefinition: new SmithyApiDefinition(modelJson, {
                'HelloLambda': SmithySubstitution.fromIntegration(helloLambdaIntegration)
            }),
            cloudWatchRole: true
        });
    }
}