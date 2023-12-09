import { LambdaClient, UpdateFunctionConfigurationCommand, Environment } from "@aws-sdk/client-lambda"; // ES Modules import

export async function setNuxtLambdaCdnUrl(id: string, cdnUrl: string) {
    const client = new LambdaClient();

    const response = await client.send(new UpdateFunctionConfigurationCommand({
        FunctionName: id,
        Environment: {
            Variables: {
                "NUXT_APP_CDN_URL": cdnUrl
            }
        }
    }));

    console.info(response);
}
