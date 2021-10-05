import { describe, it, expect } from '@jest/globals';
import { urlSearchParamsSerializer } from '../src/utils';

describe('urlSearchParamsSerializer()', () => {
  it('stringifies query parameters object', () => {
    expect(
      urlSearchParamsSerializer({
        param1: 123,
        param2: [-1, 'abc']
      }).toString()
    ).toBe(`param1=123&param2=-1&param2=abc`);
    expect(urlSearchParamsSerializer({})).toBe('');
  });

  it('stringifies URLSearchParams', () => {
    const params = new URLSearchParams();
    params.append('a', '123');
    params.append('b', 'abc');
    params.append('b', 'abc');
    expect(urlSearchParamsSerializer(params)).toBe('a=123&b=abc&b=abc');
  });

  it('converts to string non-objects', () => {
    expect(urlSearchParamsSerializer(123)).toBe('123');
    expect(urlSearchParamsSerializer('abc')).toBe('abc');
    expect(urlSearchParamsSerializer(null)).toBe('');
  });
});
