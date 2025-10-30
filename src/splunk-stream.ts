import { Writable, type WritableOptions } from "node:stream";
import { type LoggerConfig, type Payload, SplunkLogger } from "./splunk-logger";

export interface SplunkStreamOptions extends WritableOptions {
  splunk: LoggerConfig;
  fields?: Record<string, unknown>;
  onError?: (err: Error) => void;
}

export class SplunkStream extends Writable {
  private readonly logger: SplunkLogger;
  private readonly onError?: (err: Error) => void;
  private readonly fields?: Record<string, unknown>;

  constructor(options: SplunkStreamOptions) {
    super({ ...options, objectMode: true });
    this.logger = new SplunkLogger(options.splunk);
    this.onError = options.onError;
    this.fields = options.fields;
  }

  _write(
    // biome-ignore lint/suspicious/noExplicitAny: No specific type for chunk
    chunk: any,
    _encoding: string,
    callback: (err?: Error | null) => void
  ) {
    let called = false;
    const safeCallback = (err?: Error | null) => {
      if (!called) {
        called = true;
        callback(err);
      }
    };

    // biome-ignore lint/suspicious/noExplicitAny: No specific type for event
    let event: any;

    try {
      if (typeof chunk === "string") {
        try {
          event = JSON.parse(chunk);
        } catch {
          event = { message: chunk };
        }
      } else {
        event = chunk;
      }
    } catch (err) {
      this.onError?.(err as Error);
      return safeCallback(err as Error);
    }

    const payload: Payload = {
      event,
      fields: {
        ...this.fields,
        ...(event.fields ?? {}),
      },
    };

    this.logger
      .sendAsync(payload)
      .catch((err) => {
        this.onError?.(err);
      })
      .finally(() => {
        safeCallback();
      });
  }

  async close() {
    try {
      await this.logger.flush().catch((err) => this.onError?.(err));
    } finally {
      this.logger.close();
    }
  }
}
