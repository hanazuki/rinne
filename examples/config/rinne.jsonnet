local s3 = import "s3.libsonnet";

{
  stackName: 'rinne',
  env: {
    region: 'us-east-1',
  },

  githubTokenParameter: '/rinne/token',

  repositories: {
    'hanazuki/rinne': {
      policies: {
        s3: s3.read_policy('test-bucket')
      }
    }
  },
}
