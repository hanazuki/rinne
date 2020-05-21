{
  read_policy: function(bucket) [
    {
      Action: 's3:GetObject',
      Resource: 'arn:aws:s3:::%s/%s' % [bucket, '*'],
    },
  ]
}
