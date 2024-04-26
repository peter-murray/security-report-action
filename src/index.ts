import ReportGenerator from './ReportGenerator';

import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { HttpsProxyAgent } from 'https-proxy-agent';

async function run(): Promise<void> {
  try {
    const token = getRequiredInputValue('token');
    const explicitProxy = core.getInput('https_proxy');

    const generator = new ReportGenerator({
      repository: getRequiredInputValue('repository'),
      ref: getRequiredInputValue('ref'),
      sarifId: core.getInput('sarif_report_id'),
      octokit: getOctokit(token, explicitProxy),
      outputDirectory: getRequiredInputValue('outputDir'),
      templating: {
        name: 'summary'
      }
    });

    const file = await generator.run();
    console.log(file);
  } catch (err: any) {
    core.setFailed(err.message);
  }
}

run();

function getRequiredInputValue(key: string): string {
  return core.getInput(key, {required: true});
}

function getOctokit(token: string, proxy?: string) {
  const baseUrl = getApiBaseUrl();

  const octokitOptions = {
    baseUrl: baseUrl,
    auth: token,
  };
  const request = {
    agent: getProxyAgent(baseUrl, proxy),
    timeout: (10 * 1000)
  };
  octokitOptions['request'] = request;
  const client = new Octokit(octokitOptions);

  return client;
}

function getProxyAgent(baseUrl: string, proxy?: string) {
  if (proxy) {
    // User has an explict proxy set, use it
    core.info(`explicit proxy specified as '${proxy}'`);
    return new HttpsProxyAgent(proxy);
  } else {
    // When loading from the environment, also respect no_proxy settings
    const envProxy = process.env.http_proxy
      || process.env.HTTP_PROXY
      || process.env.https_proxy
      || process.env.HTTPS_PROXY
      ;

    if (envProxy) {
      core.info(`environment proxy specified as '${envProxy}'`);

      const noProxy = process.env.no_proxy || process.env.NO_PROXY;
      if (noProxy) {
        core.info(`environment no_proxy set as '${noProxy}'`);
        if (proxyExcluded(noProxy, baseUrl)) {
          core.info(`environment proxy excluded from no_proxy settings`);
        } else {
          core.info(`using proxy '${envProxy}' for GitHub API calls`)
          return new HttpsProxyAgent(envProxy);
        }
      }
    }
  }
  return null;
}

function proxyExcluded(noProxy, baseUrl) {
  if (noProxy) {
    const noProxyHosts = noProxy.split(',').map(part => part.trim());
    const baseUrlHost = new URL(baseUrl).host;

    core.debug(`noProxyHosts = ${JSON.stringify(noProxyHosts)}`);
    core.debug(`baseUrlHost = ${baseUrlHost}`);

    return noProxyHosts.indexOf(baseUrlHost) > -1;
  }
}

function getApiBaseUrl(url?: string) {
  return url || process.env['GITHUB_API_URL'] || 'https://api.github.com'
}