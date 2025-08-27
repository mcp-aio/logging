# @mcp-aio/logging

A modern TypeScript library for sending logs to Splunk HTTP Event Collector (HEC) with batching, streaming, and flexible API support.

## Features

- 🚀 **Modern TypeScript** with full type safety
- 📦 **Batching support** with configurable intervals and sizes  
- 🌊 **Stream interface** for integration with logging frameworks
- 🔄 **Dual API** - both Promise and callback styles
- 🔒 **SSL/TLS configuration** options
- ⚡ **High performance** with efficient queueing
- 🧪 **100% test coverage**

## Installation

```bash
npm install @mcp-aio/logging
```

## Quick Start

### Basic Usage

```typescript
import { SplunkLogger } from '@mcp-aio/logging';

const logger = new SplunkLogger({
  token: 'your-hec-token',
  url: 'https://your-splunk-instance:8088'
});

// Send a log event
await logger.sendAsync({
  event: { message: 'Hello Splunk!', level: 'info' }
});
```

### Stream Usage

```typescript
import { SplunkStream } from '@mcp-aio/logging';

const stream = new SplunkStream({
  splunk: {
    token: 'your-hec-token',
    url: 'https://your-splunk-instance:8088'
  }
});

// Use with any logging framework
stream.write(JSON.stringify({ message: 'Stream log' }));
```

### Use with logger frameworks

#### Pino
```typescript
import pino from "pino";
import { SplunkStream } from '@mcp-aio/logging';

const splunkStream = new SplunkStream({
  splunk: { token: "xxx", url: "https://splunk-host:8088" },
});

const logger = pino({}, pino.multistream([process.stdout, splunkStream]));

logger.info("Hello Pino + Splunk adapter!");
```

#### Bunyan
```typescript
import bunyan from "bunyan";
import { SplunkStream } from '@mcp-aio/logging';

const splunkStream = new SplunkStream({
  splunk: { token: "xxx", url: "https://splunk-host:8088" },
});

const logger = bunyan.createLogger({
  name: "myapp",
  streams: [
    { stream: process.stdout },
    { stream: splunkStream, type: "raw" },
  ],
});

logger.info("Hello Bunyan + Splunk adapter!");
```

#### Winston
```typescript
import Transport from "winston-transport";
import { SplunkStream, type SplunkStreamOptions } from '@mcp-aio/logging';

export class SplunkTransport extends Transport {
  private stream: SplunkStream;

  constructor(opts: SplunkStreamOptions) {
    super(opts);
    this.stream = new SplunkStream(opts);
  }

  log(info: any, callback: () => void) {
    setImmediate(() => this.emit("logged", info));
    this.stream.write(info);
    callback();
  }

  close() {
    this.stream.close();
  }
}

import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console(),
    new SplunkTransport({
      splunk: { token: "xxx", url: "https://splunk-host:8088" },
    }),
  ],
});

logger.info("Hello Winston + Splunk adapter!");

```

### Batching

```typescript
const logger = new SplunkLogger({
  token: 'your-hec-token',
  url: 'https://your-splunk-instance:8088',
  batchInterval: 5000,     // Flush every 5 seconds
  maxBatchCount: 100       // Or when 100 events queued
});
```

## API Reference

### SplunkLogger

#### Constructor Options

- `token` (string, required) - Splunk HEC authentication token
- `url` (string, required) - Splunk HEC endpoint URL
- `strictSSL?` (boolean) - Enable/disable SSL verification (default: true)
- `maxBatchCount?` (number) - Maximum events per batch
- `batchInterval?` (number) - Batch flush interval in milliseconds

#### Methods

- `sendAsync(payload)` - Send log event (Promise-based)
- `send(payload, callback)` - Send log event (callback-based)
- `flush()` - Manually flush queued events
- `close()` - Clean up timers and resources

### SplunkStream

Extends Node.js `Writable` stream for integration with logging frameworks.

## Development

- Install dependencies:

```bash
npm install
```

- Run the unit tests:

```bash
npm run test
```

- Build the library:

```bash
npm run build
```

- Run tests with coverage:

```bash
npm run test:coverage
```
