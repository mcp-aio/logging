import { beforeEach, describe, expect, it, vi } from "vitest";
import { SplunkLogger } from "../src/splunk-logger";
import { SplunkStream } from "../src/splunk-stream";

describe("SplunkStream", () => {
  let sendAsyncMock: any;

  beforeEach(() => {
    sendAsyncMock = vi.fn().mockResolvedValue({ code: 0, text: "ok" });
    vi.spyOn(SplunkLogger.prototype, "sendAsync").mockImplementation(
      sendAsyncMock
    );
  });

  it("should write logs to SplunkLogger successfully", async () => {
    const stream = new SplunkStream({
      splunk: { token: "xxx", url: "https://splunk.example.com:8088" },
    });

    await new Promise<void>((resolve) => {
      stream.write(JSON.stringify({ message: "test-stream" }), () => {
        expect(sendAsyncMock).toHaveBeenCalled();
        resolve();
      });
    });
  });

  it("should call onError if sendAsync rejects", async () => {
    sendAsyncMock.mockRejectedValueOnce(new Error("fail"));
    const onError = vi.fn();

    const stream = new SplunkStream({
      splunk: { token: "xxx", url: "https://splunk.example.com:8088" },
      onError,
    });

    await new Promise<void>((resolve) => {
      stream.write({ message: "fail-test" }, () => {
        setTimeout(() => {
          expect(onError).toHaveBeenCalledWith(expect.any(Error));
          resolve();
        }, 0);
      });
    });
  });

  it("should handle invalid JSON without throwing", async () => {
    const stream = new SplunkStream({
      splunk: { token: "xxx", url: "https://splunk.example.com:8088" },
    });

    await new Promise<void>((resolve) => {
      stream.write("not-json-string", () => {
        expect(sendAsyncMock).toHaveBeenCalled();
        resolve();
      });
    });
  });

  it("should handle non-string chunk in _write", async () => {
    const stream = new SplunkStream({
      splunk: { token: "xxx", url: "https://splunk.example.com:8088" },
    });

    await new Promise<void>((resolve) => {
      stream.write({ message: "object-chunk" }, () => {
        expect(sendAsyncMock).toHaveBeenCalled();
        resolve();
      });
    });
  });

  it("should merge global fields and event fields", async () => {
    const stream = new SplunkStream({
      splunk: { token: "xxx", url: "https://splunk.example.com:8088" },
      fields: { env: "production", app: "mcp" },
    });

    await new Promise<void>((resolve) => {
      stream.write({ message: "test", fields: { module: "auth" } }, () => {
        expect(sendAsyncMock).toHaveBeenCalledWith({
          event: { message: "test", fields: { module: "auth" } },
          fields: { env: "production", app: "mcp", module: "auth" },
        });
        resolve();
      });
    });
  });

  it("should close stream without error", async () => {
    const stream = new SplunkStream({
      splunk: { token: "xxx", url: "https://splunk.example.com:8088" },
    });
    await stream.close();
  });
});
