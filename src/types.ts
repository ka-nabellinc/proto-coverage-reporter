export interface IInterceptLog {
  package_name: string;
  method_name: string;
  status_code: number;
  timestamp: number;
}

export interface ILogsMap {
  [package_name: string]: {
    [method_name: string]: {
      status_codes: {
        [status_code: number]: boolean;
      };
    };
  };
}

export interface IMethodSpec {
  [method_name: string]: {
    status_codes: string[];
  };
}

export interface IProtoSpec {
  [package_name: string]: {
    [method_name: string]: {
      status_codes: string[];
    };
  };
}

export interface ICoverageResult {
  [package_name: string]: {
    [method_name: string]: {
      status_codes: {
        expected: string[];
        unchecked: string[];
        coverage: number;
      };
    };
  };
}
