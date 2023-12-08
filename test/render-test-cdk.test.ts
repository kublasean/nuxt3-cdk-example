import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { RenderTestNuxtStack } from '../lib/nuxt-stack/render-test-nuxt-stack';

// example test. To run these tests, uncomment this file along with the
// example resource in lib/render-test-cdk-stack.ts
test('Behaviors created for pre-rendered pages', () => {
    const app = new cdk.App();
    const stack = new RenderTestNuxtStack(app, 'MyTestStack');
});
