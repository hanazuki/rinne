# Rinne
## Name
rinne - manage AWS credentials for GitHub Actions

## Synopsis
**rinne** [--config _CONFPATH_] [--jpath _JPATH_]... bootstrap [_CDK-OPTION_]... [_ENVIRONMENT_]...

**rinne** [--config _CONFPATH_] [--jpath _JPATH_]... deploy [_CDK-OPTION_]...

## Descriprion
**Rinne** manages AWS access keys for GitHub Actions and configures automated access key rotation.

According to the given configuration, Rinne creates an IAM user for each GitHub repository with a set of permissions, and stores an access key for the user as GitHub Actions secrets for the repository. The access keys are periodically rotated without invoking the `rinne` command again.

## Options

- **--config** _CONFPATH_

  Uses file at _CONFPATH_ as configuration template. This file must be a valid Jsonnet template. Default: "config/rinne.jsonnet"

- **--jpath** _JPATH_

  Tells Rinne to use _JPATH_ as Jsonnet include path when it evaluates the configuration template. This option can be specified multiple times.

- _CDK-OPTION_

  Options applied to `cdk` command. Run `npx cdk --help` to see available options, or [read the manual](https://docs.aws.amazon.com/cdk/latest/guide/tools.html#cli).

## Configuration

Rinne reads configuraion file written in [Jsonnet templating language](https://jsonnet.org). The configuration file must represent a JSON object in the following structure:

```jsonnet
{
  # See also https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_core.StackProps.html#properties
  env: {
    region: 'us-east-1',  # optional
    account: 123456789012,  # optional
  },
  stackName: 'stack-name',  # optional, default: "Rinne"
  description: '...',  # optional
  tags: {  # optional
    Key: 'Value',
    # ...
  }

  # Configure GitHub personal access token to update GitHub Actions secrets.
  # This token needs `repo` scope to manage private repositories and `public_repo` scope for public ones.
  githubToken: {
    # Rinne will obtain GitHub token from this SSM parameter
    parameter: '/parameter/name',

    # If specified, kms:Decrypt on this key is granted to Rinne.
    keyId: '1234abcd-12ab-34cd-56ef-1234567890ab',  # optional
  },

  repositories: {
    'owner/repo': {
      # Managed policies to attach
      managedPolicies: [
        'arn:aws:iam::aws:policy/...',
        # ...
      ],

      # Inline policies to attach
      policies: {
        name: [
          # IAM statements
          {
            Action: '...',
            Resource: 'arn:...',
          },
          # ...
        ],
        # ...
      }
    },
    # ...
  },
}
```

## Implementation details
Rinne is built on top of the [AWS CDK](https://aws.amazon.com/cdk/) and relies on AWS CloudFormation. It evaluates the Jsonnet template to configuration, according to the configuration synthesize a CloudFormation template, and using the template deploys a CloudFormation stack.

The stack will include an IAM user for each of the managed GitHub repositories, with a set of IAM policies. It also contains a Lambda function that rotates the access keys of the IAM users and updates GitHub Actions secrets. The function will be invoked when the stack is deployed and invoked periodically triggered by a CloudWatch event.

## Further reading
- Sei Seino, "時載りリンネ! (1) はじまりの本" (_Tokinori Rinne! 1: Hajimari no Hon_), [ISBN 9784044732011](https://sneakerbunko.jp/product/tokinori/200704000021.html)
