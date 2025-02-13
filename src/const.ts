import * as os from 'os';
import * as path from 'path';

export const tmpDirPath = path.resolve(
  process.env.PROTO_COVERAGE_REPORTER_TMP_DIR_PATH || os.tmpdir(),
  `${Buffer.from(process.cwd()).toString('base64')}`,
  'proto-coverage-reporter-tmp',
);
export const logsDirPath = path.resolve(tmpDirPath, './logs');

export const Status = {
  OK: 0,
  CANCELLED: 1,
  UNKNOWN: 2,
  INVALID_ARGUMENT: 3,
  DEADLINE_EXCEEDED: 4,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  RESOURCE_EXHAUSTED: 8,
  FAILED_PRECONDITION: 9,
  ABORTED: 10,
  OUT_OF_RANGE: 11,
  UNIMPLEMENTED: 12,
  INTERNAL: 13,
  UNAVAILABLE: 14,
  DATA_LOSS: 15,
  UNAUTHENTICATED: 16,
};
