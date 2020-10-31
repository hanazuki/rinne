{
  aws: {
    account_id: std.extVar('aws:account_id'),
    url_suffix: std.extVar('aws:url_suffix'),
    partition: std.extVar('aws:partition'),
    region: std.extVar('aws:region'),
    stack_id: std.extVar('aws:stack_id'),
    stack_name: std.extVar('aws:stack_name'),
    no_value: std.extVar('aws:no_value'),
  },
}
