{
  read_policy(bucket): [
    {
      Action: 's3:GetObject',
      Resource: 'arn:aws:s3:::%s/%s' % [bucket, '*'],
    },
  ],
}
