import { AwsIntegrationProps, IntegrationType, SpecRestApi } from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cdk from "aws-cdk-lib";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { IConstruct } from "constructs";

import { format as formatUrl } from 'url';
import * as jp from 'jsonpath';


export interface SmithyIntegrationProps {
    uri: string,
    type: IntegrationType,
    credentialsRole?: iam.IRole,
    credentialsPassthrough?: boolean
}

export interface ISpecMethod {
    api: SpecRestApi,
    httpMethod: string,
    resourcePath: string,

    get methodArn(): string
    get testMethodArn(): string
}

export class SpecMethod implements ISpecMethod {
    readonly api: SpecRestApi;
    readonly httpMethod: string;
    readonly resourcePath: string;

    constructor(api: SpecRestApi, httpMethod: string, resourcePath: string) {
        this.api = api
        this.httpMethod = httpMethod
        this.resourcePath = resourcePath
    }

    get methodArn(): string {
        const stage = this.api.deploymentStage?.stageName;
        return this.api.arnForExecuteApi(this.httpMethod, pathForArn(this.resourcePath), stage);
    }

    // TODO fix this?
    get testMethodArn(): string {
        return this.api.arnForExecuteApi(this.httpMethod, pathForArn(this.resourcePath), 'test-invoke-stage');
    }

    static fromJsonPath(api: SpecRestApi, jsonPath: jp.PathComponent[]): SpecMethod {
        const resource = jsonPath
            .map((val) => val.toString())
            .filter((strVal) => strVal.startsWith('/'))
            .join('');

        const method = jsonPath.at(-4)?.toString().toUpperCase()!; // haha trust me
        return new SpecMethod(api, method, resource);
    }
}

export abstract class SmithyIntegration {

    readonly type: IntegrationType

    readonly uri: string

    readonly credentialsRole?: iam.IRole

    readonly credentialsPassthrough?: boolean

    constructor(options: SmithyIntegrationProps) {
        if (options.credentialsPassthrough !== undefined && options.credentialsRole !== undefined) {
            throw new Error('\'credentialsPassthrough\' and \'credentialsRole\' are mutually exclusive');
        }

        this.type = options.type;
        this.credentialsRole = options.credentialsRole;
        this.credentialsPassthrough = options.credentialsPassthrough;
        this.uri = options.uri;
    }

    abstract bindToSpecMethod(method: ISpecMethod): void
}

export interface SmithyLambdaIntegrationProps {
    credentialsRole?: iam.IRole,
    credentialsPassthrough?: boolean,
    allowTestInvoke?: boolean
}

export class SmithyLambdaIntegration extends SmithyIntegration {

    private handler: IFunction

    private enableTest: boolean

    constructor(handler: IFunction, props?: SmithyLambdaIntegrationProps) {
        super({
            ...props,
            type: IntegrationType.AWS,
            uri: getAwsUri(handler, {
                service: 'lambda',
                path: `2015-03-31/functions/${handler.functionArn}/invocations`
            })
        });
        this.handler = handler;
        this.enableTest = props?.allowTestInvoke ?? false;
    }

    bindToSpecMethod(method: ISpecMethod) {
        const principal = new iam.ServicePrincipal('apigateway.amazonaws.com');

        const desc = `${cdk.Names.nodeUniqueId(method.api.node)}.${method.httpMethod}.${method.resourcePath.replace(/\//g, '.')}`;

        this.handler.addPermission(`ApiPermission.${desc}`, {
            principal,
            scope: method.api,
            sourceArn: cdk.Lazy.string({ produce: () => method.methodArn }),
        });

        // add permission to invoke from the console
        if (this.enableTest) {
            this.handler.addPermission(`ApiPermission.Test.${desc}`, {
                principal,
                scope: method.api,
                sourceArn: method.testMethodArn,
            });
        }
    }
}

// Utilities below

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

function getAwsUri(scope: IConstruct, props: AwsIntegrationProps): string {
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
                region: props.region
            });
        },
    })
}

function pathForArn(path: string): string {
    return path.replace(/\{[^\}]*\}/g, '*'); // replace path parameters (like '{bookId}') with asterisk
}