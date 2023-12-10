# Render test cdk

A 'one-repo' example for Nuxt3 deployed with AWS CDK, alongside a TypeScript Lambda API with shared code

Project to demonstrate:
* deploying a Nuxt3 app to AWS Lambda
* Nuxt rendering modes, and impact on Lambda cold-start
* testing APIs locally
* sharing code between Nuxt API, and separately deployed API

The `cdk.json` file tells the CDK Toolkit how to execute your app

## Build steps
From project root run:

```bash
npm install
cdk deploy RenderTestService/ApiStack --profile {aws_profile}
cdk deploy RenderTestService/NuxtStack --profile {aws_profile}
```

That's it.

## Testing locally

### API Stack
Pre-reqs:

* [install AWS-CLI and configure with profile](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/prerequisites.html)
* [install SAM-CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
* [install Docker](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-docker.html)


Everytime a change is made do:

```
cdk synth
sam local start-api -t ./cdk.out/RenderTestServiceApiStack[UUID].template.json --warm-containers eager --profile [AWS CLI Profile]

sam local start-api -t ./cdk.out/RenderTestServiceNuxtAppStack89703BDE.template.json --warm-containers eager --profile highheat-seandev
```

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Stats

Full deploy time for NuxtStack:

```bash
✅  RenderTestService/NuxtAppStack
✨  Deployment time: 381.33s
```

Subsequent deploy (no changes), just re-triggers deploy lambda:

```bash
✅  RenderTestService/NuxtAppStack

✨  Deployment time: 64.86s
```