#!/usr/bin/env node

import * as cdn from '../cdn-helper'
import * as domain from '../index'

const nuxtLambdaArn =
    'arn:aws:lambda:us-east-2:645177761882:function:RenderTestServiceNuxtAppStack897-AppLambda46D23914-KNUHGmD2h79T';

const distributionId = 
    'E1NCLPIFHHJWLA';

async function main() {
    /*const lambdaCdnUrl = await cdn.getNuxtLambdaCdnUrl(nuxtLambdaArn);
    console.info(`lambda CDN URL: <${lambdaCdnUrl}>`);

    const cdnDomain = await cdn.getDistributionUrl(distributionId);
    console.info(`cloudfront domain: <${cdnDomain}>`);*/

    await domain.setNuxtLambdaCdnUrlFromCloudfrontDistribution(nuxtLambdaArn, distributionId);
}

main();