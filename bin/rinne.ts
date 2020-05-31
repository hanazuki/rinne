import * as cp from 'child_process';
import * as path from 'path';
import * as shellescape from 'shell-escape';

const args = parseArgs(process.argv.slice(2));

try {
  cp.execFileSync(
    'cdk',
    [
      '--app',
      shellescape([
        process.argv[0],
        path.join(__dirname, 'rinne-synth' + path.extname(process.argv[1])),
        ...args.appArgs,
      ]),
      ...args.cdkArgs,
    ],
    {
      stdio: 'inherit',
    }
  )
} catch (e) {
  console.log(e.message);
  process.exit(e.status);
}

interface Args {
  appArgs: string[];
  cdkArgs: string[];
}

function parseArgs(args: string[]): Args {
  const appArgs = [];
  const cdkArgs = [];

  for (let i = 0; i < args.length; ++i) {
    if (args[i] == '--config' || args[i] == '--jpath') {
      appArgs.push(args[i], args[i + 1]);
      ++i;
    } else {
      cdkArgs.push(args[i]);
    }
  }

  return {
    appArgs,
    cdkArgs,
  };
}
