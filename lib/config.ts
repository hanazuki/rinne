import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import { Jsonnet } from '@hanazuki/node-jsonnet';

export class RinneConfig {
  private jsonnet: Jsonnet;

  constructor() {
    this.jsonnet = this.makeJsonnet();
  }

  evaluateFile(path: string): Promise<any> {
    return this.jsonnet.evaluateFile(path);
  }

  addJpath(jpath: string): void {
    this.jsonnet.addJpath(jpath);
  }

  private makeJsonnet(): Jsonnet {
    const jsonnet = new Jsonnet();

    jsonnet.addJpath(path.resolve(__dirname, '../stdlib'))

    jsonnet.extString("aws:account_id", cdk.Aws.ACCOUNT_ID)
    jsonnet.extString("aws:url_suffix", cdk.Aws.URL_SUFFIX)
    jsonnet.extString("aws:partition", cdk.Aws.PARTITION)
    jsonnet.extString("aws:region", cdk.Aws.REGION)
    jsonnet.extString("aws:stack_id", cdk.Aws.STACK_ID)
    jsonnet.extString("aws:stack_name", cdk.Aws.STACK_NAME)
    jsonnet.extString("aws:no_value", cdk.Aws.NO_VALUE)

    return jsonnet;
  }

}
