import { getDistributionUrl, getNuxtLambdaCdnUrl, setNuxtLambdaCdnUrl, invalidateDistributionCache } from "./cdn-helper";

export { invalidateDistributionCache };

export async function setNuxtLambdaCdnUrlFromCloudfrontDistribution(lambdaId: string, distributionId: string) {
    const cdnUrl = await getDistributionUrl(distributionId);

    console.info(`cloudfront domain: <${cdnUrl}>`);

    if (!cdnUrl) {
        throw Error('Could not set NUXT_APP_CDN_URL, CDN domain was undefined');
    }

    const lambdaCdnUrl = await getNuxtLambdaCdnUrl(lambdaId);
    if (cdnUrl === lambdaCdnUrl) {
        console.info(`NUXT_APP_CDN_URL matches cloudfront domain ${cdnUrl}, quitting`);
        return;
    }

    console.info(`NUXT_APP_CDN_URL was <${lambdaCdnUrl}> setting to <${cdnUrl}>`);
    await setNuxtLambdaCdnUrl(lambdaId, cdnUrl);
}

