import * as statusCodes from '../src/status-codes';

describe('statusCodes', () => {
  describe('resolveStatusCodes', () => {
    it('produces status codes indexed by key', () => {
      expect(statusCodes.resolvedStatusCodes(['200'])).toEqual(new Map([['200', [200]]]));
    });

    it('allows wildcards', () => {
      const expected = new Map([
        ['200', [200]],
        ['2XX', [201, 202, 204, 206]]
      ]);
      expect(statusCodes.resolvedStatusCodes(['2XX', '200'])).toEqual(expected);
      expect(statusCodes.resolvedStatusCodes(['200', '2XX'])).toEqual(expected);
    });

    it('sets defaults', () => {
      const result = statusCodes.resolvedStatusCodes(['default', '2XX', '200']);
      expect(result.get('default')?.length).toBeGreaterThan(0);
      expect(result.get('default')).not.toContain(200);

      expect(statusCodes.resolvedStatusCodes(['200', '2XX', 'default'])).toEqual(result);
    });

    it('prevents incorrect status codes', () => {
      expect(() => statusCodes.resolvedStatusCodes(['20X'])).toThrow();
      expect(() => statusCodes.resolvedStatusCodes([200 as any])).toThrow();
      expect(() => statusCodes.resolvedStatusCodes(['foo'])).toThrow();
      expect(() => statusCodes.resolvedStatusCodes(['200', '200'])).toThrow();
    });
  });
});
