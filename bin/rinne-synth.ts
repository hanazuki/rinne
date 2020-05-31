import 'source-map-support/register';
import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import { RinneStack, RinneConfig } from '..';

const config = new RinneConfig();

let conffile: string | null = null;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; ++i) {
  switch (args[i]) {
    case '--config':
      conffile = args[++i];
      break;
    case '--jpath':
      config.addJpath(path.resolve(process.cwd(), args[++i]));
      break;
    default:
      console.error(`Unknown option ${args[i]}`);
      usage();
  }
}

config.evaluateFile(conffile ?? 'config/rinne.jsonnet').then(json => {
  const app = new cdk.App();
  const stack = new RinneStack(app, 'Rinne', JSON.parse(json));
  return stack;
}).catch(error => {
  console.error(error);
  process.exit(1);
});

function usage(): never {
  console.log('Usage: rinne-synth --config CONFPATH [--jpath JPATH]...');
  process.exit(1);
}
