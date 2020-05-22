local s3 = import "s3.libsonnet";

{
  stackName: 'rinne',
  env: {
    region: 'us-east-1',
  },

  githubToken: {
    parameter: '/rinne/token',
  }

  repositories: {
    'hanazuki/rinne': {
      policies: {
        s3: s3.read_policy('test-bucket')
      }
    }
  },
}
