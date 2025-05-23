// setup-fetch-mock.ts
if (typeof global !== 'undefined') {
  global.fetch = async (url, options) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({ echoed: `Echo: ${(options && options.body ? JSON.parse(options.body).message : 'No message')}` }),
      text: async () => JSON.stringify({ echoed: `Echo: ${(options && options.body ? JSON.parse(options.body).message : 'No message')}` })
    }
  }
}
