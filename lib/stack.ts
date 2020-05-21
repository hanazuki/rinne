import * as path from 'path';

import * as cdk from '@aws-cdk/core';
import * as cr from '@aws-cdk/custom-resources';
import * as cfn from '@aws-cdk/aws-cloudformation';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as ssm from '@aws-cdk/aws-ssm';
import * as targets from '@aws-cdk/aws-events-targets';

interface RepositoryConfig {
  policies: {[name: string]: any[]};
}

interface RinneProps extends cdk.StackProps {
  githubTokenParameter: string;
  logRetentionDays?: number;
  repositories: {[name: string]: RepositoryConfig};
}

const initHandlerCode = `'use strict';
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();

exports.onEvent = async function onEvent(event) {
  const {RequestType, ResourceProperties: {FunctionName, Payload}} = event;

  if (RequestType === 'Delete') {
    return {};
  }

  const resp = await lambda.invoke({
    FunctionName,
    Payload: JSON.stringify(Payload),
  }).promise();

  if(resp.FunctionError) {
    console.log(JSON.parse(resp.Payload));
    throw resp.FunctionError;
  }

  return {Data: JSON.parse(resp.Payload)};
}`;

export class RinneStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props: RinneProps) {
    super(scope, id, props);

    const users: {[name: string]: iam.User} = {};
    for(const [reponame, repo] of Object.entries(props.repositories)) {
      const user = new iam.User(this, `GH/${reponame}`);

      for(const [polname, stmts] of Object.entries(repo.policies)) {
        user.attachInlinePolicy(
          new iam.Policy(this, `GH/${reponame}/${polname}`, {
            policyName: polname,
            statements: stmts.map(iam.PolicyStatement.fromJson),
          })
        );
      }

      users[reponame] = user;
    };

    const updater = new lambda.Function(this, 'UpdaterFunction', {
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../ncc.out')),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      environment: {
        GitHubTokenParameter: props.githubTokenParameter,
      },
      logRetention: props.logRetentionDays ?? 30,
      initialPolicy: [
        new iam.PolicyStatement({
          actions: [
            'iam:CreateAccessKey',
            'iam:ListAccessKeys',
            'iam:DeleteAccessKey',
          ],
          resources: Object.values(users).map(u => u.userArn),
        }),
        new iam.PolicyStatement({
          actions: [
            'ssm:GetParameter',
          ],
          resources: [
            cdk.Arn.format({
              service: 'ssm',
              resource: 'parameter',
              resourceName: props.githubTokenParameter,
              sep: '',
            }, this),
          ],
        }),
      ],
    });

    const initProvider = new cr.Provider(this, 'InitProvider', {
      onEventHandler: new lambda.SingletonFunction(this, 'InitHandler', {
        uuid: '99b59f5d-19e5-4dfc-94a5-aab3aaf04500',
        code: lambda.Code.fromInline(initHandlerCode),
        handler: 'index.onEvent',
        timeout: cdk.Duration.seconds(60),
        runtime: lambda.Runtime.NODEJS_10_X,
        initialPolicy: [
          new iam.PolicyStatement({
            actions: ['lambda:InvokeFunction'],
            resources: [updater.functionArn],
          })
        ],
      }),
    })

    const cron = new events.Rule(this, 'Schedule-Rule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
    });

    for(const [reponame, user] of Object.entries(users)) {
      const payload = {
        repo: reponame,
        user: user.userName,
      }

      cron.addTarget(new targets.LambdaFunction(updater, {
        event: events.RuleTargetInput.fromObject(payload),
      }));

      new cfn.CustomResource(this, `Init/${reponame}`, {
        provider: initProvider,
        properties: {
          FunctionName: updater.functionName,
          Payload: payload,
        }
      });

    }
  }
}
