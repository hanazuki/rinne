import 'source-map-support/register';
import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import { Jsonnet } from '@hanazuki/node-jsonnet';
import { RinneStack } from '..';

const jsonnet = new Jsonnet();

let conffile: string | undefined = void(0);

const args = process.argv.slice(2);
for(let i = 0; i < args.length; ++i) {
  switch(args[i]) {
    case '--config':
      conffile = args[++i];
      break;
    case '--jpath':
      const jpath = path.resolve(process.cwd(), args[++i]);
      jsonnet.addJpath(jpath);
      console.log(jpath);
      break;
    default:
      console.error(`Unknown option ${args[i]}`);
      usage();
  }
}

if(!conffile) {
  usage();
}

jsonnet.evaluateFile(conffile).then(json => {
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
