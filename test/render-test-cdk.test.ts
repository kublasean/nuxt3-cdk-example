import * as cdk from 'aws-cdk-lib';
import { RenderTestNuxtStack } from '../lib/nuxt-stack/render-test-nuxt-stack';
import { RenderTestApiStack } from '../lib/api-stack/render-test-api-stack';

// example test. To run these tests, uncomment this file along with the
// example resource in lib/render-test-cdk-stack.ts
test('Behaviors created for pre-rendered pages', () => {
    const app = new cdk.App();
    const stack = new RenderTestApiStack(app, 'MyTestStack');
});
