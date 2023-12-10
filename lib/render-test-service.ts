import { Construct } from 'constructs';
import { RenderTestApiStack } from './api-stack/render-test-api-stack';
import { RenderTestNuxtStack } from './nuxt-stack/render-test-nuxt-stack';

export class RenderTestService extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        new RenderTestApiStack(this, 'ApiStack');
        new RenderTestNuxtStack(this, 'NuxtStack');
    }
}
