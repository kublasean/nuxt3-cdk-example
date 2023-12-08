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


export class RenderTestNuxtStack extends cdk.Stack {

    private cacheForeverPolicy: cloudfront.ICachePolicy
    private cdn: cdk.aws_cloudfront.Distribution;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Bucket should not be publicly accessible
        const assetsBucket = new s3.Bucket(this, 'AppAssetsBucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
        });

        // Deploy assets to bucket
        const assetsDeployment = new s3deploy.BucketDeployment(this, 'DeployAssets', {
            sources: [s3deploy.Source.asset(path.join(__dirname, 'app/.output/public'))],
            destinationBucket: assetsBucket,
            prune: true
        });

        const appLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'AppLambda', {
            description: "Runs the Nuxt app server on AWS Lambda",
            entry: path.join(__dirname, 'app/.output/server/index.mjs'),
            runtime: lambda.Runtime.NODEJS_18_X,
            timeout: cdk.Duration.seconds(15),
            depsLockFilePath: path.join(__dirname, 'app/package-lock.json'),
            tracing: lambda.Tracing.ACTIVE
        });
        const appLambdaUrl = appLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE
        });
        const appLambdaOrigin = new origins.HttpOrigin(cdk.Fn.parseDomainName(appLambdaUrl.url), {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY
        });

        this.cacheForeverPolicy = new cloudfront.CachePolicy(this, `${id}-CacheForeverPolicy`, {
            comment: 'Policy to cache data in CDN until invalidated by the next deploy, or a year passes',
            minTtl: cdk.Duration.days(365),
            enableAcceptEncodingBrotli: true,
            enableAcceptEncodingGzip: true
        });

        // CDN, default behavior: send request to Nuxt Lambda for SSR, never cache
        this.cdn = new cloudfront.Distribution(this, `${id}-AppCdn`, {
            defaultBehavior: {
                origin: appLambdaOrigin,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED
            },
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        });

        // Additional behavior: static pages cached forever after being rendered the first time by Nuxt Lambda
        const cacheForeverPagePaths: string[] = [
            '/', 
            '/level-one/level-two/*'
        ]
        const staticPagesPaths: string[] = [];
        for (const path of cacheForeverPagePaths) {
            staticPagesPaths.push(path);
            if (path.length && path.charAt(path.length-1) === '/') {
                staticPagesPaths.push(`${path}index.html`);
            }
        }
        this.addCacheForeverBehaviors(staticPagesPaths, appLambdaOrigin);

        // Additional behavior: public assets in S3 cached forever after gotten first time
        const assetsPaths: string[] = fs.readdirSync(path.join(__dirname, 'app/.output/public'), { withFileTypes: true }).map(item => {
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
        this.cdn.grantCreateInvalidation(deployHelperLambda);

        new triggers.Trigger(this, `${id}-cacheInvalidationDeploymentTrigger`, {
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