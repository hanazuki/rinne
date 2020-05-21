import * as path from 'path';

import * as cdk from '@aws-cdk/core';
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

    const cron = new events.Rule(this, 'Schedule-Rule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
    });

    for(const [reponame, user] of Object.entries(users)) {
      cron.addTarget(new targets.LambdaFunction(updater, {
        event: events.RuleTargetInput.fromObject({
          repo: reponame,
          user: user.userName,
        }),
      }));
    }
  }
}
