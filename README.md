# Rinne
## Name
rinne - manage AWS credentials for GitHub Actions

## Synopsis
**rinne** [--config _CONFPATH_] [--jpath _JPATH_]... bootstrap [_CDK-OPTION_]... [ENVIRONMENT]...

**rinne** [--config _CONFPATH_] [--jpath _JPATH_]... deploy [_CDK-OPTION_]...

## Descriprion
**Rinne** manages AWS access keys for GitHub Actions and configures automated access key rotation.

According to the given configuration, Rinne creates an IAM user for each GitHub repository with a set of permissions, and stores an access key for the user as GitHub Actions secrets for the repository. The access keys are periodically rotates without invoking the *rinne* command again.

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

## Further reading
- Sei Seino, "時載りリンネ! (1) はじまりの本" (_Tokinori Rinne! 1: Hajimari no Hon_), [ISBN 9784044732011](https://sneakerbunko.jp/product/tokinori/200704000021.html)
