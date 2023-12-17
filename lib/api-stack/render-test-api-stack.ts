import { Construct } from 'constructs';
import { HttpMethod } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as iam from 'aws-cdk-lib/aws-iam';
import {
    AccessLogFormat,
    ApiDefinition,
    ApiDefinitionConfig,
    AwsIntegrationProps,
    Cors,
    InlineApiDefinition,
    LambdaIntegration,
    LogGroupLogDestination,
    MethodLoggingLevel,
    RestApi,
    RestApiBaseProps,
    SpecRestApi,
    SpecRestApiProps,
  } from "aws-cdk-lib/aws-apigateway";

import * as fs from 'fs';
import * as path from 'path';
import * as jp from 'jsonpath';
import { format as formatUrl } from 'url';


export type SubstitutionIntegration = lambda.IFunction

// https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk-lib/aws-apigateway/lib/util.ts
function parseAwsApiCall(path?: string, action?: string, actionParams?: { [key: string]: string }): { apiType: string, apiValue: string } {
    if (actionParams && !action) {
      throw new Error('"actionParams" requires that "action" will be set');
    }
  
    if (path && action) {
      throw new Error(`"path" and "action" are mutually exclusive (path="${path}", action="${action}")`);
    }
  
    if (path) {
      return {
        apiType: 'path',
        apiValue: path,
      };
    }
  
    if (action) {
      if (actionParams) {
        action += '&' + formatUrl({ query: actionParams }).slice(1);
      }
  
      return {
        apiType: 'action',
        apiValue: action,
      };
    }
  
    throw new Error('Either "path" or "action" are required');
}

export class OpenApiSubstitution {
    public uri?: string

    public credentials?: string

    public integration?: SubstitutionIntegration

    // https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk-lib/aws-apigateway/lib/integrations/aws.ts#L80
    private static getUri(scope: Construct, props: AwsIntegrationProps) {
        const backend = props.subdomain ? `${props.subdomain}.${props.service}` : props.service;
        const { apiType, apiValue } = parseAwsApiCall(props.path, props.action, props.actionParameters);
        
        return cdk.Lazy.string({
            produce: () => {
                if (!scope) { throw new Error('AwsIntegration must be used in API'); }
                return cdk.Stack.of(scope).formatArn({
                    service: 'apigateway',
                    account: backend,
                    resource: apiType,
                    arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
                    resourceName: apiValue,
                    region: props.region,
                });
            },
        });
    }

    constructor(uri?: string, credentials?: string, integration?: SubstitutionIntegration) {
        if (!uri && !credentials) {
            throw Error("OpenApiSubsitution must have uri or credentials, both cannot be undefined");
        }

        this.uri = uri;
        this.credentials = credentials;
        this.integration = integration
    }

    public static fromParameters(uri?: string, credentials?: string) {
        return new OpenApiSubstitution(uri, credentials);
    }

    public static fromLambda(scope: Construct, handler: lambda.IFunction): OpenApiSubstitution {
        const uri = OpenApiSubstitution.getUri(scope, {
            service: "lambda",
            path: `2015-03-31/functions/${handler.functionArn}/invocations`,
        });

        return new OpenApiSubstitution(uri, undefined, handler);
    }
}

export class MutableInlineApiDefinition extends InlineApiDefinition {

    public methodIntegrations: {
        method: string,
        resourcePath: string,
        integration: SubstitutionIntegration
    }[]

    private static getSubstitutionKey(wrappedSubKey: string) {
        if (wrappedSubKey.length < 4 || 
            wrappedSubKey[0] != '$' || 
            wrappedSubKey[1] != '{' ||
            wrappedSubKey[wrappedSubKey.length - 1] != '}') 
        {
            throw Error("Values for Fn::Sub must be wrapped like ${KeyName}, where KeyName is the substitution key");
        }

        const subKey = wrappedSubKey.substring(2, wrappedSubKey.length - 1);
        //console.log(subKey);

        return subKey;
    }

    private static getResourceAndMethod(jsonPath: jp.PathComponent[]): { resource: string, method: string } {
        
        const resource = jsonPath
            .map((val) => val.toString())
            .filter((strVal) => strVal.startsWith('/'))
            .join('');

        const method = jsonPath.at(-4)?.toString().toUpperCase()!; // haha trust me

        return {
            resource: resource,
            method: method
        }
    }

    private static shouldGenerateCredentials(json: any, jsonPath: jp.PathComponent[]): boolean {
        console.log(jsonPath);

        const newPath = jsonPath.slice(0, -2);
        newPath.push('credentials');

        if (jp.value(json, jp.stringify(newPath))) {
            return false;
        }
        return true;
    }

    constructor(definition: any, substitutions: { [key: string]: OpenApiSubstitution }) {

        const methodIntegrations: {
            method: string,
            resourcePath: string,
            integration: SubstitutionIntegration
        }[] = [];

        const nodes = jp.nodes(definition, "$..['Fn::Sub']");
        for (const node of nodes) {
            //console.log(node.value);

            if (node.path.length < 2) {
                throw Error("Fn::Sub is only supported for uri and credentials");
            }

            const parent = node.path[node.path.length-2];
            const subKey = MutableInlineApiDefinition.getSubstitutionKey(node.value);
            
            if (subKey in substitutions === false) {
                throw Error(`Unmatched substitution ${subKey}`);
            }

            const sub = substitutions[subKey];
            let newValue: string

            if (parent === "uri") {
                console.log(`replacing uri ${subKey} with ${sub.uri}`);
                newValue = sub.uri!;

                if (sub.integration && MutableInlineApiDefinition.shouldGenerateCredentials(definition, node.path)) {
                    const parsedPath = MutableInlineApiDefinition.getResourceAndMethod(node.path);

                    methodIntegrations.push({
                        resourcePath: parsedPath.resource,
                        integration: sub.integration,
                        method: parsedPath.method
                    });
                }

            } else if (parent == "credentials") {
                newValue = "";
            } else {
                throw Error("Fn::Sub is only supported for uri and credentials");
            }

            node.path.pop();
            const query = jp.stringify(node.path);

            jp.value(definition, query, newValue);
        }

        super(definition)

        this.methodIntegrations = methodIntegrations;
    }
}

export interface SmithyApiRestApiProps extends SpecRestApiProps {
    apiDefinition: MutableInlineApiDefinition
}

export class SmithyRestApi extends SpecRestApi {

    // https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk-lib/aws-apigateway/lib/method.ts#L513
    private static pathForArn(path: string): string {
        return path.replace(/\{[^\}]*\}/g, '*'); // replace path parameters (like '{bookId}') with asterisk
    }

    constructor(scope: Construct, id: string, props: SmithyApiRestApiProps) {
        super(scope, id, props)

        for (const method of props.apiDefinition.methodIntegrations) {
            const stage = this.deploymentStage?.stageName;
            const arn: string = this.arnForExecuteApi(method.method, SmithyRestApi.pathForArn(method.resourcePath), stage);
            const desc = `${cdk.Names.nodeUniqueId(this.node)}.${method.method}.${method.resourcePath.replace(/\//g, '.')}`;
            
            method.integration.addPermission(`ApiPermission.${desc}`, {
                principal: new iam.ServicePrincipal('apigateway.amazonaws.com'), 
                scope: this,
                sourceArn: arn
            });
        }
    }
}

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

        //console.log(this.resolve((helloLambda.node.defaultChild as cdk.CfnElement).logicalId));

        const api = new SmithyRestApi(this, 'helloApi', {
            apiDefinition: new MutableInlineApiDefinition(modelJson, {
                'HelloLambda': OpenApiSubstitution.fromLambda(this, helloLambda)
            }),
            cloudWatchRole: true
        });

    }
}