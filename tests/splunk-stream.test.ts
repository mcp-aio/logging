import { beforeEach, describe, expect, it, vi } from "vitest";
import { SplunkStream } from "../src/splunk-stream";

describe("SplunkStream", () => {
  // Just mock fetch
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  it("should write logs to SplunkLogger successfully", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"text":"ok","code":0}',
    });

    const stream = new SplunkStream({
      splunk: { token: "xxx", url: "https://splunk.example.com:8088" },
    });

    await new Promise<void>((resolve) => {
      stream.write(JSON.stringify({ message: "test-stream" }), () => {
        expect(fetchMock).toHaveBeenCalled();
        resolve();
      });
    });
  });

  it("should call onError when log fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "fail",
    });

    const onError = vi.fn();

    const stream = new SplunkStream({
      splunk: { token: "xxx", url: "https://splunk.example.com:8088" },
      onError,
    });

    await new Promise<void>((resolve) => {
      stream.write(JSON.stringify({ message: "fail-test" }), () => {
        setTimeout(() => {
          expect(onError).toHaveBeenCalled();
          resolve();
        }, 0);
      });
    });
  });

  it("should handle invalid JSON in stream", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"text":"ok","code":0}',
    });

    const stream = new SplunkStream({
      splunk: { token: "xxx", url: "https://splunk.example.com:8088" },
    });

    await new Promise<void>((resolve) => {
      stream.write("not-json-string", () => {
        expect(fetchMock).toHaveBeenCalled();
        resolve();
      });
    });
  });

  it("should close stream without error", () => {
    const stream = new SplunkStream({
      splunk: { token: "xxx", url: "https://splunk.example.com:8088" },
    });
    stream.close();
    // if no error, test passes
  });

  it("should handle non-string chunk in _write", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"text":"ok","code":0}',
    });

    const stream = new SplunkStream({
      splunk: { token: "xxx", url: "https://splunk.example.com:8088" },
    });

    await new Promise<void>((resolve) => {
      stream.write({ message: "object-chunk" }, () => {
        expect(fetchMock).toHaveBeenCalled();
        resolve();
      });
    });
  });

  it("should call console.warn if sendAsync fails and no onError", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("fail"));
    global.fetch = mockFetch;

    // biome-ignore lint/suspicious/noEmptyBlockStatements: no implement
    const warnMock = vi.spyOn(console, "warn").mockImplementation(() => {});

    const stream = new SplunkStream({
      splunk: { token: "xxx", url: "https://splunk.example.com:8088" },
    });

    await new Promise<void>((resolve) => {
      stream.write({ message: "error-chunk" }, () => {
        // setTimeout to wait async catch
        setTimeout(() => {
          expect(warnMock).toHaveBeenCalledWith(
            "Splunk logging failed:",
            "fail"
          );
          warnMock.mockRestore();
          resolve();
        }, 0);
      });
    });
  });
});
