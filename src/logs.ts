import * as fs from 'fs';
import * as path from 'path';
import { logsDirPath } from './const';
import type { IInterceptLog, ILogsMap } from './types';

const generateRandomString = () => `${Date.now()}${Math.random()}`;

export function writeLog(log: IInterceptLog): void {
  const fileName = generateRandomString();
  fs.writeFileSync(path.resolve(logsDirPath, `${fileName}.json`), JSON.stringify(log));        
}

export async function readLogsMap(): Promise<ILogsMap> {
  const exist = fs.existsSync(logsDirPath);
  if (!exist) {
    console.info('[proto-coverage-reporter]: logs folder does not exist');
    return {};
  }

  const logsDir = fs.readdirSync(logsDirPath);
  const logs: IInterceptLog[] = await Promise.all(
    logsDir.map(async log => {
      const filePath = path.resolve(logsDirPath, log);

      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }),
  );

  return logs.reduce((acc, ac) => {
    const { package_name, method_name, status_code } = ac;
    acc[package_name] = {
      ...(acc[package_name] || {}),
      [method_name]: {
        status_codes: {
          ...(((acc[package_name] || {})[method_name] || {}).status_codes || {}),
          [status_code]: true,
        },
      },
    };

    return acc;
  }, {} as ILogsMap);
}
