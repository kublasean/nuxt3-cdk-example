import { Construct } from 'constructs';

import { APP_LAMBDA_ENV, APP_DISTRIBUTION_ENV } from './render-test-nuxt-stack.invalidate';

import * as path from 'path';
import * as fs from 'fs';

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment"
import * as cloudfront from "aws-cdk-lib/aws-cloudfront"
import * as origins from "aws-cdk-lib/aws-cloudfront-origins"
import * as triggers from 'aws-cdk-lib/triggers';
import { ExecSyncOptions, execSync } from 'child_process';
import { OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';

function getNuxtAppBuilder(): cdk.ILocalBundling {

    return {
        tryBundle(outputDir: string, options: cdk.BundlingOptions): boolean {
            const execOptions: ExecSyncOptions = { stdio: ['ignore', process.stderr, 'inherit'] };
            const commands: string[] = [
                'npm install',
                'npm run build',
                `cp .output ${outputDir}`
            ];

            console.log("Building nuxtApp");
            for (const command of commands) {
                const output = execSync(command, execOptions);
                console.log(output);
            }
            return true;
        }
    }
}

interface NuxtAppPaths {
    public: string,
    handler: string,
    lockFile: string
}

function buildNuxtApp(nuxtAppSourcePath: string): NuxtAppPaths {

    const defaultPaths: NuxtAppPaths = {
        public: path.join(nuxtAppSourcePath, '.output', 'public'),
        handler: path.join(nuxtAppSourcePath, '.output', 'server', 'index.mjs'),
        lockFile: path.join(nuxtAppSourcePath, 'package-lock.json')
    };

    const execOptions: ExecSyncOptions = { stdio: ['ignore', process.stderr, 'inherit'] };

    if (!fs.existsSync(defaultPaths.public) || !fs.existsSync(defaultPaths.handler)) {

        const commands: string[] = [
            'npm install', 
            'npm run build'
        ]

        console.log(`building NuxtApp in ${nuxtAppSourcePath}...`);

        for (const command of commands) {
            execSync(command, {
                ...execOptions,
                cwd: nuxtAppSourcePath
            });
        }
    } else {
        console.log('using pre-built NuxtApp, build manually to update');
    }

    return defaultPaths;
}

export class RenderTestNuxtStack extends cdk.Stack {

    private cacheForeverPolicy: cloudfront.ICachePolicy
    private cdn: cdk.aws_cloudfront.Distribution;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Build nuxtApp locally
        const nuxtApp = buildNuxtApp(path.join(__dirname, 'app'));

        // Private site assets bucket (for css, fonts, images, etc..)
        const assetsBucket = new s3.Bucket(this, 'assetsBucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            publicReadAccess: false
        });

        // Deploy nuxt public output to site assets bucket
        const assetsDeployment = new s3deploy.BucketDeployment(this, 'assetsDeployment', {
            sources: [s3deploy.Source.asset(nuxtApp.public)],
            destinationBucket: assetsBucket,
            prune: true
        });

        const appLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'appLambda', {
            description: "Runs the Nuxt app server on AWS Lambda",
            entry: nuxtApp.handler,
            runtime: lambda.Runtime.NODEJS_18_X,
            timeout: cdk.Duration.seconds(15),
            depsLockFilePath: nuxtApp.lockFile,
            tracing: lambda.Tracing.ACTIVE,
            bundling: {
                format: OutputFormat.ESM,
                esbuildArgs: {
                    "--log-override:ignored-bare-import": 'silent'
                }
            }
        });

        const appLambdaUrl = appLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE
        });
        const appLambdaOrigin = new origins.HttpOrigin(cdk.Fn.parseDomainName(appLambdaUrl.url), {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY
        });

        this.cacheForeverPolicy = new cloudfront.CachePolicy(this, 'cacheForeverPolicy', {
            comment: 'Policy to cache data in CDN until invalidated by the next deploy, or a year passes',
            minTtl: cdk.Duration.days(365),
            enableAcceptEncodingBrotli: true,
            enableAcceptEncodingGzip: true
        });

        // CDN, default behavior: send request to Nuxt Lambda for SSR, never cache
        this.cdn = new cloudfront.Distribution(this, 'appCdn', {
            defaultBehavior: {
                origin: appLambdaOrigin,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED
            },
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        });

        // Additional behavior: static pages cached forever after being rendered the first time by Nuxt Lambda
        const staticPagesPaths: string[] = [
            '/', 
            '/level-one/level-two/*'
        ]
        this.addCacheForeverBehaviors(staticPagesPaths, appLambdaOrigin);

        // Additional behavior: public assets in S3 cached forever after gotten first time
        const assetsPaths: string[] = fs.readdirSync(nuxtApp.public, { withFileTypes: true }).map(item => {
            if (item.isDirectory()) {
                return `${item.name}/*`
            }
            return item.name
        });
        this.addCacheForeverBehaviors(assetsPaths, new origins.S3Origin(assetsBucket));

        // Trigger to invalidate ALL CDN paths
        // Putting current time in lambda forces this trigger to fire on every deployment
        const deployHelperLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'invalidate', {
            runtime: lambda.Runtime.NODEJS_18_X,
            description: `Invalidates Cloudfront NuxtApp distribution on NuxtStackDeployment ${new Date().toUTCString()}`,
            environment: {
                [APP_DISTRIBUTION_ENV]: this.cdn.distributionId,
                [APP_LAMBDA_ENV]: appLambda.functionArn
            }
        });
        this.cdn.grant(deployHelperLambda, 
            "cloudfront:GetDistribution",
            "cloudfront:CreateInvalidation"
        );
        deployHelperLambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
            resources: [
                appLambda.functionArn
            ],
            actions: [
                "lambda:GetFunctionConfiguration",
                "lambda:SetFunctionConfiguration",
                "lambda:UpdateFunctionConfiguration"
            ]
        }));

        new triggers.Trigger(this, 'invalidateTrigger', {
            handler: deployHelperLambda,
            invocationType: triggers.InvocationType.REQUEST_RESPONSE,
            executeAfter: [assetsDeployment, appLambda, this.cdn]
        });
    }

    private addCacheForeverBehaviors(pathPatterns: string[], origin: cloudfront.IOrigin) {
        for (const pathPattern of pathPatterns) {
            this.cdn.addBehavior(pathPattern, origin, {
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                compress: true,
                cachePolicy: this.cacheForeverPolicy,
            });
        }
    }
}