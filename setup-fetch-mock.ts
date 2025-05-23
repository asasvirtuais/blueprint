// setup-fetch-mock.ts
class MockResponse {
  body: string;
  status: number;
  headers: Record<string, string>;
  ok: boolean;
  constructor(body: string, { status = 200, headers = {} } = {}) {
    this.body = body;
    this.status = status;
    this.headers = headers;
    this.ok = status >= 200 && status < 300;
  }
  async json() {
    return JSON.parse(this.body);
  }
  async text() {
    return this.body;
  }
}

if (typeof global !== "undefined") {
  // @ts-expect-error: Accept mock Response as compatible for test
  global.fetch = async (url, options) => {
    const message = options && options.body ? JSON.parse(options.body.toString()).message : 'No message';
    const body = JSON.stringify({ echoed: `Echo: ${message}` });
    return new MockResponse(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}
