import { GetFunctionConfigurationCommand, LambdaClient, UpdateFunctionConfigurationCommand } from "@aws-sdk/client-lambda"; // ES Modules import
import { CloudFrontClient, CreateInvalidationCommand, GetDistributionCommand } from "@aws-sdk/client-cloudfront"; // ES Modules import

const lambdaClient = new LambdaClient();
const cloudFrontClient = new CloudFrontClient();

export async function getNuxtLambdaCdnUrl(id: string): Promise<string | undefined> {
    const response = await lambdaClient.send(new GetFunctionConfigurationCommand({
        FunctionName: id
    }));

    return response.Environment?.Variables?.NUXT_APP_CDN_URL;
}

export async function setNuxtLambdaCdnUrl(id: string, cdnUrl: string) {
    const response = await lambdaClient.send(new UpdateFunctionConfigurationCommand({
        FunctionName: id,
        Environment: {
            Variables: {
                "NUXT_APP_CDN_URL": cdnUrl
            }
        }
    }));

    console.debug(response);
}

export async function getDistributionUrl(distributionId: string): Promise<string | undefined> {

    const response = await cloudFrontClient.send(new GetDistributionCommand({
        Id: distributionId
    }));

    const domain = response.Distribution?.DomainName;
    return domain ? `https://${domain}` : undefined;
}

export async function invalidateDistributionCache(distributionId: string) {
    const resp = await cloudFrontClient.send(new CreateInvalidationCommand({
        DistributionId: distributionId, 
        InvalidationBatch: {
            Paths: {
                Quantity: 1,
                Items: [
                    '/*'
                ]
            },
            CallerReference: new Date().toUTCString()
        }
    }));

    console.debug(resp);
}