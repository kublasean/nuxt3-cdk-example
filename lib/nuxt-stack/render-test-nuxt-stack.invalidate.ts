import { Handler } from 'aws-lambda';
import { setNuxtLambdaCdnUrl } from 'render-test';

export const APP_LAMBDA_ENV: string = 'APP_LAMBDA_ARN';
export const APP_DISTRIBUTION_ENV: string = 'APP_DISTRIBUTION_ARN';

export const handler: Handler = async (event, context) => {

    console.log(event);

    console.log(context);

    const appLambdaArn = process.env[APP_LAMBDA_ENV];

    const appDistributionArn = process.env[APP_DISTRIBUTION_ENV];

    console.info(appLambdaArn);
    console.info(appDistributionArn);

    //setNuxtLambdaCdnUrl(appLambdaArn, );

    return true;
};