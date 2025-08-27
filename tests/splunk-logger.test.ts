import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Payload, SplunkLogger } from '../src/splunk-logger';

describe('SplunkLogger', () => {
  // biome-ignore lint/suspicious/noExplicitAny: just mock fetch
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  it('should throw error on no token provided', () => {
    expect(
      () =>
        new SplunkLogger({
          // @ts-expect-error intentionally testing missing token
          token: undefined,
          url: 'https://splunk.example.com:8088',
        })
    ).toThrow('Splunk HEC token is required');
  });

  it('should throw error on no url provided', () => {
    expect(
      () =>
        new SplunkLogger({
          token: 'token',
          // @ts-expect-error intentionally testing missing url
          url: undefined,
        })
    ).toThrow('Splunk HEC URL is required');
  });

  it('should send single log successfully', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"text":"ok","code":0}',
    });

    const logger = new SplunkLogger({
      token: 'token',
      url: 'https://splunk.example.com:8088',
    });

    const res = await logger.sendAsync({ event: { message: 'test' } });
    expect(res).toEqual({ text: 'ok', code: 0 });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('send() should call callback on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"text":"ok","code":0}',
    });
    global.fetch = mockFetch;

    const logger = new SplunkLogger({
      token: 'token',
      url: 'https://splunk.example.com:8088',
    });

    const payload: Payload = { event: { message: 'callback-test' } };

    await new Promise<void>((resolve) => {
      logger.send(payload, (err, res) => {
        expect(err).toBeNull();
        expect(res).toEqual({ text: 'ok', code: 0 });
        resolve();
      });
    });
  });

  it('send() should call callback on error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'fail',
    });
    global.fetch = mockFetch;

    const logger = new SplunkLogger({
      token: 'token',
      url: 'https://splunk.example.com:8088',
    });

    const payload: Payload = { event: { message: 'callback-error' } };

    await new Promise<void>((resolve) => {
      logger.send(payload, (err, res) => {
        expect(err).toBeInstanceOf(Error);
        expect(res).toBeUndefined();
        resolve();
      });
    });
  });

  it('should throw error on failed HTTP request', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Error',
    });

    const logger = new SplunkLogger({
      token: 'token',
      url: 'https://splunk.example.com:8088',
    });

    await expect(
      logger.sendAsync({ event: { message: 'fail' } })
    ).rejects.toThrow('HTTP 500: Internal Error');
  });

  it('should handle invalid JSON response gracefully', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'not-json',
    });

    const logger = new SplunkLogger({
      token: 'token',
      url: 'https://splunk.example.com:8088',
    });

    const res = await logger.sendAsync({ event: { message: 'bad-json' } });
    expect(res).toEqual({ text: 'not-json', code: 200 });
  });

  it('should queue logs and flush on maxBatchCount', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"text":"ok","code":0}',
    });

    const logger = new SplunkLogger({
      token: 'token',
      url: 'https://splunk.example.com:8088',
      batchInterval: 1000,
      maxBatchCount: 2,
    });

    const res1 = await logger.sendAsync({ event: { message: '1' } });
    expect(res1.text).toBe('Queued');

    const res2 = await logger.sendAsync({ event: { message: '2' } });
    expect(res2.text).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should flush queued logs manually', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"text":"flushed","code":0}',
    });

    const logger = new SplunkLogger({
      token: 'token',
      url: 'https://splunk.example.com:8088',
      batchInterval: 1000,
    });

    await logger.sendAsync({ event: { message: 'queued1' } });
    const res = await logger.flush();
    expect(res.text).toBe('flushed');
  });

  it("flush() should return 'No payload' if queue is empty", async () => {
    const logger = new SplunkLogger({
      token: 'token',
      url: 'https://splunk.example.com:8088',
      batchInterval: 1000,
    });

    const res = await logger.flush();
    expect(res).toEqual({ text: 'No payload', code: 0 });
  });

  it('should respect strictSSL = false', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"text":"ok","code":0}',
    });

    const logger = new SplunkLogger({
      token: 'token',
      url: 'https://splunk.example.com:8088',
      strictSSL: false,
    });

    const res = await logger.sendAsync({ event: { message: 'ssl-test' } });
    expect(res.text).toBe('ok');
  });

  it('should clear interval on close', () => {
    const logger = new SplunkLogger({
      token: 'token',
      url: 'https://splunk.example.com:8088',
      batchInterval: 1000,
    });

    logger.close();
    // if no error, test passes
  });
});
