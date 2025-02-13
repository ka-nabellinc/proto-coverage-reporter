import * as fs from 'fs';
import * as path from 'path';
import { type Interceptor, InterceptingCall, ListenerBuilder } from '@grpc/grpc-js';
import type { IInterceptLog } from '../types';
import { logsDirPath } from '../const';

const generateRandomString = () => `${Date.now()}${Math.random()}`;

export const protoCoverageInterceptor: Interceptor = (options, nextCall) =>
  new InterceptingCall(nextCall(options), {
    start: (metadata, listener, next) => {
      // Metadataを再設定
      const metadataMap = (options as any).internalRepr;
      if (typeof metadataMap === 'object') {
        for (const [key, value] of (metadataMap as any as Map<any, any>).entries()) {
          metadata.set(key, value);
        }
      }

      const methodPath = options.method_definition.path;
      const [package_name, method_name] = methodPath.split('/').filter(Boolean);

      const _listener = new ListenerBuilder();
      _listener.withOnReceiveStatus((status, next) => {
        const log: IInterceptLog = {
          package_name,
          method_name,
          status_code: status.code,
          timestamp: Date.now(),
        };

        const fileName = generateRandomString();
        fs.writeFileSync(path.resolve(logsDirPath, `${fileName}.json`), JSON.stringify(log));
        next(status);
      });

      next(metadata, _listener.build());
    },
  });
