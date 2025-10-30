import { Agent } from "undici";

export type LoggerConfig = {
  token: string;
  url: string;
  strictSSL?: boolean;
  maxBatchCount?: number;
  batchInterval?: number;
  index?: string;
};

export type Payload = {
  event: unknown;
  fields?: Record<string, unknown>;
  index?: string;
};

export type SplunkResponse = {
  text: string;
  code: number;
};

export type SendCallback = (
  err: Error | null,
  response?: SplunkResponse
) => void;

export class SplunkLogger {
  private readonly config: LoggerConfig;
  private queue: Payload[] = [];
  private readonly timer?: NodeJS.Timeout;
  private readonly dispatcher?: Agent;

  constructor(config: LoggerConfig) {
    if (!config.token) {
      throw new Error("Splunk HEC token is required");
    }
    if (!config.url) {
      throw new Error("Splunk HEC URL is required");
    }

    this.config = {
      strictSSL: true,
      ...config,
    };

    if (this.config.strictSSL === false) {
      this.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
    }

    if (this.config.batchInterval && this.config.batchInterval > 0) {
      this.timer = setInterval(() => {
        this.flush().catch((err) => {
          // biome-ignore lint/suspicious/noConsole: console should be used in this place
          console.warn("Splunk flush failed (ignored):", err.message);
        });
      }, this.config.batchInterval);
    }
  }

  /**
   * Send a single log event (callback style, legacy)
   */
  send(payload: Payload, callback?: SendCallback): void {
    this.sendAsync(payload)
      .then((res) => callback?.(null, res))
      .catch((err) => callback?.(err));
  }

  /**
   * Send a single log event (Promise style, recommended)
   */
  async sendAsync(payload: Payload): Promise<SplunkResponse> {
    if (this.config.batchInterval != null) {
      this.queue.push(payload);

      if (
        this.config.maxBatchCount &&
        this.queue.length >= this.config.maxBatchCount
      ) {
        return await this.flush();
      }

      return Promise.resolve({ text: "Queued", code: 0 });
    }

    return this.doSend([payload]);
  }

  /**
   * Flush queued log events (Promise style)
   */
  async flush(): Promise<SplunkResponse> {
    if (this.queue.length === 0) {
      return { text: "No payload", code: 0 };
    }

    const toSend = [...this.queue];
    this.queue = [];
    return await this.doSend(toSend);
  }

  /**
   * Perform actual HTTP request using fetch
   */
  private async doSend(payloads: Payload[]): Promise<SplunkResponse> {
    const url = `${this.config.url}/services/collector/event`;
    const body = payloads
      .map((p) => JSON.stringify({ index: this.config.index, ...p }))
      .join("\n");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Splunk ${this.config.token}`,
        "Content-Type": "application/json",
      },

      body,
      dispatcher: this.dispatcher,
    });

    const text = await res.text();
    if (res.ok) {
      try {
        return JSON.parse(text);
      } catch {
        return { text, code: res.status };
      }
    } else {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
  }

  /**
   * Clear batch timer
   */
  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
