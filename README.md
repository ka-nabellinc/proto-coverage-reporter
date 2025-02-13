# proto-coverage-reporter

Protobuf method call coverage reporter for gRPC Server E2E testing.
Works along with [Jest](https://jestjs.io/).

This tool ensures all the specified status_codes are checked during the test.

## Install

```sh
npm i -D proto-coverage-reporter # npm
yarn add -D proto-coverage-reporter # yarn
```

## Prerequisites

Use extension.proto(TBD) to specify method options for your service.

```proto
syntax = "proto3";

package tutorial;

import "tcg_platform/grpc/v1/extension.proto";

service HelloService {
  rpc Greet(GreetRequest) returns (GreetResponse) {
    option (tcg_platform.grpc.v1.spec) = {
      status_codes: ["OK", "INVALID_ARGUMENTS", "ALREADY_EXISTS", "PERMISSION_DENIED"]
    };
  }
}
```

## Setup gRPC client interceptor

To record gRPC client call histories, or footprints, you need to register a custom interceptor for your needs.

The following example is for Node.js usage.

```js
import { protoCoverageInterceptor } from 'proto-coverage-reporter';
import { credentials } from '@grpc/grpc-js';
import { HelloServiceClient } from './gen/proto/hello_grpc_pb';

const client = new HelloServiceClient(
  'localhost:3000',
  credentials.createInsecure(),
  {
    interceptors: [protoCoverageInterceptor]
  }
)
```

## Setup Jest custom reporter

Register as a jest custom reporter.

```js
module.exports = {
  ...
  reporters: [
    "default",
    ["proto-coverage-reporter", {
      coverageFrom: [
        {
          packageName: "tutorial.HelloService",
          serviceProtoPath: "<rootDir>/proto/tutorial/hello.proto"
        }
      ]
    }]
  ]
}
```

## Options

| Option Name | Required | Type | Description
| --- | --- | --- | --- |
| coverageFrom | true | Array | Target service destination to collect coverages from |
| coverageFrom[].packageName | true | String | package identifier |
| coverageFrom[].serviceProtoPath | true | String | file path for protocol buffer |
