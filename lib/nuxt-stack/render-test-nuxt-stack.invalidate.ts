import { Handler } from 'aws-lambda';
import * as domain from 'render-test';

export const APP_LAMBDA_ENV: string = 'APP_LAMBDA_ARN';
export const APP_DISTRIBUTION_ENV: string = 'APP_DISTRIBUTION_ID';

export const handler: Handler = async (event, context) => {

    const appLambdaArn = process.env[APP_LAMBDA_ENV];
    const appDistributionId = process.env[APP_DISTRIBUTION_ENV];
    console.info(`appLambdaArn: <${appLambdaArn}>`);
    console.info(`appDistributionId: <${appDistributionId}>`);

    if (!appLambdaArn || !appDistributionId) {
        throw Error('Environment variables must be set');
    }

    // ensure the CDN URL of the app is set
    await domain.setNuxtLambdaCdnUrlFromCloudfrontDistribution(appLambdaArn, appDistributionId);

    // then invalidate the CDN cache. This way after making app changes
    // pages/assets previously generated will be replaced by new versions.
    // should always be the last deployment step, so that old-versions are not replaced until 
    // the new versions are ready
    await domain.invalidateDistributionCache(appDistributionId);

    return true;
};