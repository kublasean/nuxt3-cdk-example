#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RenderTestService } from '../lib/render-test-service';

const app = new cdk.App();
new RenderTestService(app, 'RenderTestService');