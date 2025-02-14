import * as fs from 'fs';
import * as path from 'path';
import type { Config } from '@jest/types';
import type { Reporter } from '@jest/reporters';
import type { TestContext } from '@jest/test-result';
import type { AggregatedResult } from '@jest/test-result';
import { context, getOctokit } from '@actions/github'
import { logsDirPath, Status } from '../const';
import { readLogsMap } from '../logs';
import { parseMethodSpec } from './proto';
import type { ILogsMap, IProtoSpec, ICoverageResult } from '../types';

const Table = require('cli-table'); // eslint-disable-line @typescript-eslint/no-var-requires
const chalk = require('chalk'); // eslint-disable-line @typescript-eslint/no-var-requires

export interface IReporterOption {
  coverageFrom?: {
    packageName?: string;
    serviceProtoPath?: string;
  }[];
}

export default class ProtoCoverageReporter implements Reporter {
  private protoSpec: IProtoSpec = {};

  constructor(
    private globalConfig: Config.GlobalConfig,
    private options: IReporterOption,
  ) {
    const { coverageFrom } = options;

    // proto解析
    if (!coverageFrom || !coverageFrom.length) {
      throw new Error('[proto-coverage-reporter]: coverageFrom option is required');
    }
    for (const data of coverageFrom) {
      const { packageName, serviceProtoPath } = data;
      if (!packageName || !serviceProtoPath) {
        throw new Error('[proto-coverage-reporter]: packageName and serviceProtoPath are required');
      }
      const serviceProtoAbsolutePath = this.getServiceProtoAbsolutePath(serviceProtoPath);
      const methodSpec = parseMethodSpec(serviceProtoAbsolutePath, packageName);
      this.protoSpec[packageName] = methodSpec;
    }

    fs.mkdirSync(logsDirPath, { recursive: true });
  }

  async onRunComplete(testContexts: Set<TestContext>, originalResults: AggregatedResult) {
    const logsMap = await readLogsMap();
    const parsed = this.parseResult(logsMap);
    this.stdoutCoverage(parsed);
    this.createComment(parsed)

    this.removeLogsDir();
  }

  parseResult(logsMap: ILogsMap) {
    const parsed = Object.entries(this.protoSpec).reduce((acc, [packageName, methods]) => {
      acc[packageName] = Object.entries(methods).reduce(
        (acc, [methodName, spec]) => {
          const desiredStatusCodes = spec.status_codes;
          const statusCodes = logsMap[packageName]?.[methodName]?.status_codes || {};
          const uncheckedStatusCodes = desiredStatusCodes.filter(
            statusCode => !statusCodes[Status[statusCode as keyof typeof Status]],
          );
          const uncehckedPercentage = uncheckedStatusCodes.length / desiredStatusCodes.length;
          const coverage = Math.round(100 - uncehckedPercentage * 100);
          acc[methodName] = {
            status_codes: {
              expected: desiredStatusCodes,
              unchecked: uncheckedStatusCodes,
              coverage,
            },
          };
          return acc;
        },
        {} as ICoverageResult[typeof packageName],
      );

      return acc;
    }, {} as ICoverageResult);

    return parsed;
  }

  stdoutCoverage(result: ICoverageResult) {
    const table = new Table({
      style: { head: ['white'] },
      head: ['Package', 'Method', 'Coverage', 'Unchecked Status'],
    });

    for (const [packageName, methods] of Object.entries(result)) {
      for (const [methodName, { status_codes }] of Object.entries(methods)) {
        const { coverage, unchecked } = status_codes;

        table.push([
          packageName,
          coverage === 100 ? chalk.green(methodName) : chalk.red(methodName),
          coverage === 100 ? chalk.green(`${coverage}%`) : chalk.red(`${coverage}%`),
          chalk.red(unchecked.join(', ')),
        ]);
      }
    }

    console.log(table.toString());
  }

  async createComment(result: ICoverageResult) {
    const { eventName } = context
    console.log('eventName', eventName)
    if (!eventName || eventName !== 'push') return

    console.log('inside createComment')
    console.log('issue', context.issue)
    console.log('pr', context.payload.pull_request)
    console.log('pr num', context.payload.pull_request?.number)
    console.log('GITHUB_TOKEN', process.env.GITHUB_TOKEN)
    console.log(context)
    console.log('//////////checking env ///////////')
    console.log(process.env)

    const octokit = getOctokit(process.env.GITHUB_TOKEN!)

    const issues = await octokit.rest.issues.listForRepo({
      owner: context.repo.owner,
      repo: context.repo.repo,
      state: 'open',
    })

    const prs = issues.data.map(i => i.pull_request).filter(Boolean)
    console.log('prs', prs)
  }

  getServiceProtoAbsolutePath(serviceProtoPath: string) {
    if (serviceProtoPath.startsWith('<rootDir>')) {
      return path.join(this.globalConfig.rootDir, serviceProtoPath.slice('<rootDir>'.length));
    } else {
      return serviceProtoPath;
    }
  }

  removeLogsDir() {
    fs.rmSync(logsDirPath, { recursive: true });
  }
}
