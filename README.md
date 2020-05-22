# rinne
## Synopsis
**rinne** [--config _CONFPATH_] [--jpath _JPATH_]... bootstrap [_CDK-OPTION_]... [ENVIRONMENT]...

**rinne** [--config _CONFPATH_] [--jpath _JPATH_]... deploy [_CDK-OPTION_]...

## Descriprion
**rinne** manages AWS access keys in GitHub Actions Secrets and configures automated access key rotation.

## Configuration

rinne reads configuraion file written in [Jsonnet templating language](https://jsonnet.org). The configuration file must represent a JSON object in the following structure:

```jsonnet
{
  githubToken: {
    # rinne will obtain GitHub token from this SSM parameter
    parameter: '/parameter/name',
    keyId: '1234abcd-12ab-34cd-56ef-1234567890ab',  # optional
  },

  repositories: {
    'owner/repo': {
      managed_policies: [
        'arn:aws:iam::aws:policy/...',
        # ...
      ],

      policies: {
        name: [
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

[CDK stack properties](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_core.StackProps.html#properties), including `stackName`, `env` and `tags`, can also be specified in the configuration object.

## Further reading
- Sei Seino, "時載りリンネ!" (_Tokinori Rinne!_), vol. 1, [ISBN 9784044732011](https://sneakerbunko.jp/product/tokinori/200704000021.html)
