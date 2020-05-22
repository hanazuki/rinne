local s3 = import "s3.libsonnet";

{
  stackName: 'rinne-example',
  env: {
    region: 'us-east-1',
  },

  githubToken: {
    parameter: '/rinne/token',
  },

  repositories: {
    'hanazuki/rinne': {
      managedPolicies: [
        'arn:aws:iam::aws:policy/CloudFrontReadOnlyAccess',
      ],

      policies: {
        s3: s3.read_policy('test-bucket'),
      },
    }
  },
}
