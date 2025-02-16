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
    this.createPRComment(parsed)

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

  async createPRComment(result: ICoverageResult) {
    try {
      if (typeof process.env.GITHUB_TOKEN !== 'string' || !process.env.GITHUB_TOKEN) return
      const { eventName, repo: { owner, repo }, sha } = context
      console.log('eventName', eventName)
      if (!eventName || eventName !== 'push') return

      const octokit = getOctokit(process.env.GITHUB_TOKEN!)
      const { data: prs } = await octokit.rest.pulls.list({
        owner,
        repo,
        head: sha,
      })
      if (!prs || !prs.length) return

      const coverages: number[] = []
      const formattedLogs: string[] = []

      for (const [packageName, methods] of Object.entries(result)) {
        for (const [methodName, { status_codes }] of Object.entries(methods)) {
          const { coverage, unchecked } = status_codes;
          coverages.push(coverage)
          formattedLogs.push(`| ${packageName} | ${methodName} | ${coverage}% | ${unchecked.join(', ')} |`)
        }
      }

      const totalCoverage = Math.round(coverages.reduce((acc, cur) => acc + cur, 0) / coverages.length)

      await Promise.all(prs.map(async pr => {
        const { number: issue_number } = pr

        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number,
          body: `
![Proto Coverage Result](https://img.shields.io/badge/Proto_Coverage-${totalCoverage}%25-${totalCoverage === 100 ? 'brightgreen' : 'red'})

<details open>
  <summary>Coverage Report</summary>

| Package | Method | Coverage | Unchecked Status |
| --- | --- | --- | --- |
${formattedLogs.join('\n')}
</details>
          `.trim()
        })
      }))

    } catch (e) {
      console.error(e)
      console.error('Failed to create PR comment')
    }
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
