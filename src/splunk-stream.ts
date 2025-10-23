import { Writable, type WritableOptions } from "node:stream";
import { type LoggerConfig, type Payload, SplunkLogger } from "./splunk-logger";

export interface SplunkStreamOptions extends WritableOptions {
  splunk: LoggerConfig;
  onError?: (err: Error) => void; // optional error handler
}

export class SplunkStream extends Writable {
  private readonly logger: SplunkLogger;
  private readonly onError?: (err: Error) => void;

  constructor(options: SplunkStreamOptions) {
    super({ ...options, objectMode: true });
    this.logger = new SplunkLogger(options.splunk);
    this.onError = options.onError;
  }

  // biome-ignore lint/suspicious/noExplicitAny: chunk could be anything
  _write(chunk: any, _encoding: string, callback: () => void) {
    // Bunyan/Pino will send JSON string
    let payload: Payload;
    if (typeof chunk === "string") {
      try {
        payload = { event: JSON.parse(chunk) };
      } catch {
        payload = { event: { message: chunk } };
      }
    } else {
      payload = { event: chunk };
    }

    this.logger.sendAsync(payload).catch((err) => {
      if (this.onError) {
        this.onError(err);
      } else {
        // biome-ignore lint/suspicious/noConsole: we should use console in this place
        console.warn("Splunk logging failed:", err.message);
      }
    });

    callback();
  }

  close() {
    this.logger.close();
  }
}
