import { isValidPath, Type } from '../src/reflection-type';

describe('isValidPath', () => {
  describe('object', () => {
    it('checks plain objects with no additional properties', () => {
      const atype: Type = {
        type: 'object',
        additionalProperties: false,
        properties: {
          prop: { value: { type: 'string' }, required: false }
        }
      };

      expect(isValidPath(atype, ['prop'])).toBe(true);
      expect(isValidPath(atype, ['not-prop'])).toBe(false);
    });

    it('checks plain objects with any additional properties', () => {
      const atype: Type = {
        type: 'object',
        additionalProperties: true,
        properties: {
          prop: { value: { type: 'string' }, required: false }
        }
      };

      expect(isValidPath(atype, ['prop'])).toBe(true);
      expect(isValidPath(atype, ['anything'])).toBe(true);
    });

    it('checks plain objects with specific additional properties', () => {
      const atype: Type = {
        type: 'object',
        additionalProperties: {
          type: 'object',
          additionalProperties: false,
          properties: {
            inner_prop: { value: { type: 'string' }, required: false }
          }
        },
        properties: {
          prop: { value: { type: 'string' }, required: false }
        }
      };

      expect(isValidPath(atype, ['prop'])).toBe(true);
      expect(isValidPath(atype, ['inner_prop'])).toBe(true);
      expect(isValidPath(atype, ['not_inner_prop'])).toBe(true);
    });
  });

  describe('array', () => {
    it('checks basic arrays', () => {
      const atype: Type = {
        type: 'array',
        items: { type: 'string' }
      };

      expect(isValidPath(atype, ['[]'])).toBe(true);
      expect(isValidPath(atype, ['prop'])).toBe(false);
    });

    it('checks basic arrays of objects', () => {
      const atype: Type = {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: { prop: { value: { type: 'string' }, required: false } }
        }
      };

      expect(isValidPath(atype, ['[]', 'prop'])).toBe(true);
      expect(isValidPath(atype, ['[]', 'not-prop'])).toBe(false);
    });
  });

  describe('union & intersection', () => {
    it('checks union', () => {
      const atype: Type = {
        type: 'union',
        options: [
          {
            type: 'object',
            additionalProperties: false,
            properties: { prop: { value: { type: 'string' }, required: false } }
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: { other_prop: { value: { type: 'string' }, required: false } }
          },
          { type: 'string' }
        ]
      };

      expect(isValidPath(atype, ['prop'])).toBe(true);
      expect(isValidPath(atype, ['other_prop'])).toBe(true);
      expect(isValidPath(atype, ['not-prop'])).toBe(false);
    });

    it('checks intersection', () => {
      const atype: Type = {
        type: 'intersection',
        options: [
          {
            type: 'object',
            additionalProperties: false,
            properties: { prop: { value: { type: 'string' }, required: false } }
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: { other_prop: { value: { type: 'string' }, required: false } }
          },
          { type: 'string' }
        ]
      };

      expect(isValidPath(atype, ['prop'])).toBe(true);
      expect(isValidPath(atype, ['other_prop'])).toBe(true);
      expect(isValidPath(atype, ['not-prop'])).toBe(false);
    });
  });

  describe('nested', () => {
    it('checks complex nested objects', () => {
      const atype: Type = {
        type: 'object',
        additionalProperties: false,
        properties: {
          prop: {
            value: {
              type: 'union',
              options: [
                {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    prop2: {
                      value: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            prop4: { value: { type: 'string' }, required: false }
                          }
                        }
                      },
                      required: false
                    }
                  }
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    prop3: {
                      value: {
                        type: 'string'
                      },
                      required: false
                    }
                  }
                }
              ]
            },
            required: false
          }
        }
      };

      expect(isValidPath(atype, ['prop', 'prop2', '[]', 'prop4'])).toBe(true);
      expect(isValidPath(atype, ['prop', 'prop3', '[]', 'prop4'])).toBe(false);
      expect(isValidPath(atype, ['prop', 'prop3'])).toBe(true);
    });
  });
});
