import { Octokit } from '@octokit/rest';
import * as AWS from 'aws-sdk';
import * as sodium from 'tweetsodium';
import sortBy = require('lodash.sortby');

interface Event {
  repo: string;
  user: string;
  destroying?: boolean;
}

const iam = new AWS.IAM();
const ssm = new AWS.SSM();

const tokenParam = process.env['GitHubTokenParameter'];
if (!tokenParam) {
  throw new Error('GitHubTokenParameter is not set');
}

const octokit = ssm.getParameter({
  Name: tokenParam, WithDecryption: true
}).promise().then(token => new Octokit({ auth: token.Parameter?.Value }));

interface Pubkey {
  key_id: string;
  key: string;
}

const getPubkey = async (owner: string, repo: string): Promise<Pubkey> => {
  return (await (await octokit).actions.getPublicKey({ owner, repo })).data;
}

const updateSecret = async (owner: string, repo: string, secret_name: string, value: string, pubkey: Pubkey): Promise<void> => {
  const messageBytes = Buffer.from(value);
  const keyBytes = Buffer.from(pubkey.key, 'base64');
  const encryptedBytes = sodium.seal(messageBytes, keyBytes);
  const encryptedValue = Buffer.from(encryptedBytes).toString('base64');

  await (await octokit).actions.createOrUpdateRepoSecret({
    owner,
    repo,
    secret_name,
    encrypted_value: encryptedValue,
    key_id: pubkey.key_id,
  })
  console.log(`Updated GitHub Actions secret ${secret_name} for ${owner}/${repo}`);
}

const deleteSecret = async (owner: string, repo: string, secret_name: string): Promise<void> => {
  await (await octokit).actions.deleteRepoSecret({
    owner,
    repo,
    secret_name,
  })
  console.log(`Deleted GitHub Actions secret ${secret_name} for ${owner}/${repo}`);
}

const EXPIRY = 6 * 60 * 60 * 1000;

export const handler = async (event: Event): Promise<any> => {
  const [owner, repo] = event.repo.split('/', 2);

  if (event.destroying) {
    await Promise.all([
      deleteSecret(owner, repo, 'AWS_ACCESS_KEY_ID'),
      deleteSecret(owner, repo, 'AWS_SECRET_ACCESS_KEY'),
    ])
    return {};
  }

  console.log(`Starting key rotation for GitHub repository ${owner}/${repo} and IAM user ${event.user}.`);

  const accessKeys = sortBy(
    (await iam.listAccessKeys({ UserName: event.user }).promise()).AccessKeyMetadata,
    (k: AWS.IAM.AccessKeyMetadata) => k.CreateDate
  );
  const currentKey = accessKeys.pop();
  const expiringKey = accessKeys.pop();

  if (currentKey?.AccessKeyId && currentKey.CreateDate) {
    const keyAge = Date.now() - currentKey.CreateDate.getTime();
    if (keyAge < EXPIRY / 2) {
      console.log(`Current access key ${currentKey.AccessKeyId} is ${Math.floor(keyAge / 1000)}s old; skipping rotation.`);
      return;
    }
  }

  const pubkey = getPubkey(owner, repo);

  if (expiringKey?.AccessKeyId) {
    await iam.deleteAccessKey({ UserName: event.user, AccessKeyId: expiringKey.AccessKeyId }).promise();
    console.log(`Deleted access key ${expiringKey.AccessKeyId}.`);
  }

  const newKey = await iam.createAccessKey({ UserName: event.user }).promise();
  console.log(`Created access key ${newKey.AccessKey.AccessKeyId}.`);

  await Promise.all([
    updateSecret(owner, repo, 'AWS_ACCESS_KEY_ID', newKey.AccessKey.AccessKeyId, await pubkey),
    updateSecret(owner, repo, 'AWS_SECRET_ACCESS_KEY', newKey.AccessKey.SecretAccessKey, await pubkey),
  ])
  return {};
}
