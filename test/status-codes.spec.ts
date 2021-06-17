import * as statusCodes from '../src/status-codes';

describe('statusCodes', () => {
  describe('resolveStatusCodes', () => {
    it('produces status codes indexed by key', () => {
      expect(statusCodes.resolvedStatusCodes(['200'])).toEqual(new Map([['200', [200]]]));
    });

    it('allows wildcards', () => {
      expect(statusCodes.resolvedStatusCodes(['2XX', '200'])).toEqual(
        new Map([
          ['200', [200]],
          ['2XX', [201, 202, 204, 206]]
        ])
      );
    });

    it('sets defaults', () => {
      const result = statusCodes.resolvedStatusCodes(['2XX', 'default']);
      expect(result.get('default')?.length).toBeGreaterThan(0);
      expect(result.get('default')).not.toContain(200);
    });
  });
});
