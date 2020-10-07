import * as path from 'path';

import * as cdk from '@aws-cdk/core';
import * as cr from '@aws-cdk/custom-resources';
import * as cfn from '@aws-cdk/aws-cloudformation';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as targets from '@aws-cdk/aws-events-targets';

interface RepositoryConfig {
  managedPolicies?: string[];
  policies?: { [name: string]: any[] };
}

interface GitHubToken {
  parameter: string;
  keyId?: string;
}

interface RinneProps extends cdk.StackProps {
  githubToken: GitHubToken;
  logRetentionDays?: number;
  repositories: { [name: string]: RepositoryConfig };
}

const initHandlerCode = `'use strict';
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();

exports.onEvent = async function onEvent(event) {
  const {RequestType, ResourceProperties: {FunctionName, Payload}} = event;

  if (RequestType === 'Delete') {
    Payload.destroying = true;
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

export namespace Tags {
  export const GitHubRepository = 'rinne.hanazuki.dev/githubRepository';
}

export class RinneStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props: RinneProps) {
    super(scope, id, props);

    const users: { [name: string]: iam.User } = {};
    for (const [reponame, repo] of Object.entries(props.repositories)) {
      const user = new iam.User(this, this.sanitizeForConstructId(`GH/${reponame}`));
      cdk.Tags.of(user).add(Tags.GitHubRepository, reponame);

      if (repo.managedPolicies) {
        for (const polarn of repo.managedPolicies) {
          user.addManagedPolicy(
            iam.ManagedPolicy.fromManagedPolicyArn(this, this.sanitizeForConstructId(`GH/${reponame}/${polarn}`), polarn)
          );
        }
      }

      if (repo.policies) {
        for (const [polname, stmts] of Object.entries(repo.policies)) {
          user.attachInlinePolicy(
            new iam.Policy(this, this.sanitizeForConstructId(`GH/${reponame}/${polname}`), {
              policyName: polname,
              statements: stmts.map(iam.PolicyStatement.fromJson),
            })
          );
        }
      }

      users[reponame] = user;
    };

    const parameter = props.githubToken.parameter;
    const parameterArn = parameter.startsWith('arn:')
      ? parameter
      : cdk.Arn.format({
        service: 'ssm',
        resource: 'parameter',
        resourceName: parameter,
        sep: '',
      }, this);

    const updater = new lambda.Function(this, 'UpdaterFunction', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../ncc.out')),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      environment: {
        GitHubTokenParameter: props.githubToken.parameter,
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
          resources: [parameterArn],
        }),
      ],
    });

    const keyId = props.githubToken.keyId;
    if (keyId) {
      const keyArn = keyId.startsWith('arn:')
        ? keyId
        : cdk.Arn.format({
          service: 'kms',
          resource: 'key',
          resourceName: keyId,
        }, this);

      updater.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            'kms:Decrypt',
          ],
          resources: [keyArn],
        })
      );
    }

    const initProvider = new cr.Provider(this, 'InitProvider', {
      onEventHandler: new lambda.SingletonFunction(this, 'InitHandler', {
        uuid: '99b59f5d-19e5-4dfc-94a5-aab3aaf04500',
        code: lambda.Code.fromInline(initHandlerCode),
        handler: 'index.onEvent',
        timeout: cdk.Duration.seconds(60),
        runtime: lambda.Runtime.NODEJS_12_X,
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

    for (const [reponame, user] of Object.entries(users)) {
      const payload = {
        repo: reponame,
        user: user.userName,
      };

      cron.addTarget(new targets.LambdaFunction(updater, {
        event: events.RuleTargetInput.fromObject(payload),
      }));

      const init = new cfn.CustomResource(this, this.sanitizeForConstructId(`Init/${reponame}`), {
        provider: initProvider,
        properties: {
          FunctionName: updater.functionName,
          Payload: payload,
        }
      });

      cron.node.addDependency(init);
    }
  }

  private sanitizeForConstructId(s: string): string {
    return s.replace(/\$\{([^}]+)\}/g, '--\\1--')
  }
}
