import * as assert from 'assert';

export function resolvedStatusCodes(codes: string[]): Map<string, number[]> {
  const seen = new Set();
  codes.forEach(code => {
    assert(
      typeof code === 'string',
      `HTTP status codes must be strings, got ${code} with type ${typeof code}`
    );
    assert(!seen.has(code), `Duplicate status code ${code}`);
    assert(
      /^\dXX$/.test(code) || /^default$/.test(code) || /^\d\d\d$/.test(code),
      `Malformed http status code ${code}`
    );
    seen.add(code);
  });
  const record = new Map();
  const matchers: RegExp[] = codes.sort().map(c => {
    if (c === 'default') {
      return /.*/;
    }
    return new RegExp(c.replace(/XX$/, '..'));
  });
  for (const code of statusCodes) {
    for (let i = 0; i < matchers.length; i++) {
      const tester = matchers[i];
      if (tester.test(String(code))) {
        const existing = record.get(codes[i]);
        if (existing) {
          existing.push(code);
        } else {
          record.set(codes[i], [code]);
        }
        break;
      }
    }
  }
  return record;
}

const statusCodes = [
  100, 200, 201, 202, 204, 206, 301, 302, 303, 304, 307, 308, 400, 401, 403, 404, 406, 407, 408,
  410, 412, 416, 418, 422, 425, 429, 451, 500, 501, 502, 503, 504
];
