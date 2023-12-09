import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ListTablesCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.info('hello lambda');

    const command = new ListTablesCommand({});
    const response = await client.send(command);
    console.log(response);

    return {
        statusCode: 200,
        body: JSON.stringify({
            tableNames: response.TableNames ?? []
        })
    };
};