import * as fs from 'fs';
import { Root } from 'protobufjs';
import type { IMethodSpec } from '../types';

const OPTION_IDENTIFIER = '(tcg_platform.grpc.v1.spec)';

export function parseMethodSpec(serviceProtoAbsolutePath: string, packageName: string) {
  if (!fs.existsSync(serviceProtoAbsolutePath)) {
    throw new Error(`[proto-coverage-reporter]: ${serviceProtoAbsolutePath} is not exist`);
  }
  const methodSpec: IMethodSpec = {};
  const proto = new Root().loadSync(serviceProtoAbsolutePath);
  const service = proto.lookupService(packageName);

  for (const method of Object.values(service.methods)) {
    const parsedOptions: Record<string, { status_codes: string[] }>[] = method.parsedOptions || [];
    const targetOption = parsedOptions.find(option => !!option[OPTION_IDENTIFIER]);
    if (!targetOption) continue;
    const { status_codes } = targetOption[OPTION_IDENTIFIER];
    methodSpec[method.name] = { status_codes };
  }

  return methodSpec;
}
