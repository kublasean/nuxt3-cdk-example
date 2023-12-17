$version: "2.0"

namespace nuxt3cdkexample

use aws.protocols#restJson1
use aws.apigateway#requestValidator
use aws.apigateway#integration

/// Provides a friendly greeting from a AWS API Gateway deployed REST API
@restJson1
@requestValidator("full")
@title("RenderTest Service API")
@integration(
    type: "aws_proxy",
    uri: "${HelloLambda}",
    httpMethod: "POST"
)
service RenderTest {
    version: "2023-12-12"
    operations: [SayHiV1, SayHiV2]
    // Add common errors that could be thrown by any route in the service
}

@readonly
@http(method: "GET", uri: "/hello.v1")
operation SayHiV1 {
    output := {
        @required
        greeting: String
    }
}

@readonly
@http(method: "GET", uri: "/hello.v2")
operation SayHiV2 {
    output := {
        @required
        greeting: String

        @required
        tone: String
    }
}
