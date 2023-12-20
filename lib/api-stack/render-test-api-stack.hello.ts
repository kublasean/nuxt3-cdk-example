import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.info('hello lambda');

    const name: string = event.queryStringParameters!['name']!;

    return {
        statusCode: 200,
        body: JSON.stringify({
            greeting: `Hi ${name}! -- from api lambda`
        })
    };
};