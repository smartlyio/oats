import * as make from '../src/make';
import * as jsc from 'jsverify';
import { TestClass } from './test-class';
import { Type } from '../src/reflection-type';

describe('union differentation', () => {
  it('handles cases where union children are missing the tag', () => {
    const atype: Type = {
      type: 'union',
      options: [
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            tag: {
              value: {
                type: 'string',
                enum: ['b']
              },
              required: true
            }
          }
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            val: {
              value: { type: 'string' },
              required: true
            }
          }
        }
      ]
    };
    const fun = make.fromReflection({ type: 'union', options: [atype] });
    expect(fun({ tag: 'b' }).success()).toEqual({ tag: 'b' });
    expect(fun({ val: 'something' }).success()).toEqual({ val: 'something' });
  });

  it('uses discriminator to build values allowing unions as children', () => {
    const atype: Type = {
      type: 'union',
      options: [
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            unionTag: {
              value: {
                type: 'string',
                enum: ['b']
              },
              required: true
            },
            tag: {
              value: {
                type: 'string',
                enum: ['b']
              },
              required: true
            }
          }
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            unionTag: {
              value: {
                type: 'string',
                enum: ['b']
              },
              required: true
            },
            tag: {
              value: {
                type: 'string',
                enum: ['a']
              },
              required: true
            }
          }
        }
      ]
    };
    const fun = make.fromReflection({ type: 'union', options: [atype] });
    expect(fun({ tag: 'a', unionTag: 'b' }).success()).toEqual({ unionTag: 'b', tag: 'a' });
  });

  it('uses discriminator to build values', () => {
    const atype: Type = {
      type: 'object',
      additionalProperties: false,
      properties: {
        tag: {
          value: {
            type: 'named',
            reference: {
              name: 'a',
              isA: 1 as any,
              maker: 1 as any,
              definition: {
                type: 'string',
                enum: ['a']
              }
            }
          },
          required: true
        }
      }
    };
    const btype: Type = {
      type: 'named',
      reference: {
        maker: make.fromReflection({
          type: 'object',
          additionalProperties: false,
          properties: {
            tag: { value: { type: 'string', enum: ['b'] }, required: true }
          }
        }),
        isA: 1 as any,
        name: 'aa',
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            tag: { value: { type: 'string', enum: ['b'] }, required: true }
          }
        }
      }
    };
    const fun = make.fromReflection({ type: 'union', options: [atype, btype] });
    expect(fun({ tag: 'b' }).success()).toEqual({ tag: 'b' });
  });
});

describe('named', () => {
  it('uses the maker from name', () => {
    const type: Type = {
      type: 'named',
      reference: {
        name: 'aa',
        definition: 1 as any,
        isA: 1 as any,
        maker: make.fromReflection({ type: 'string' })
      }
    };
    const fun = make.fromReflection(type);
    const result = fun('aaa').success();
    expect(result).toEqual('aaa');
  });
});

describe('union', () => {
  it('succeeds if only one match', () => {
    const type: Type = {
      type: 'union',
      options: [
        {
          type: 'object',
          additionalProperties: false,
          properties: { a: { required: true, value: { type: 'string' } } }
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: { a: { required: true, value: { type: 'number' } } }
        }
      ]
    };
    const fun = make.fromReflection(type);
    expect(fun({ a: 1 }).success()).toEqual({ a: 1 });
  });

  it('prefers matching ValueClass', () => {
    const type: Type = {
      type: 'union',
      options: [
        {
          type: 'unknown'
        },
        {
          type: 'named',
          reference: {
            name: 'aa',
            definition: 1 as any,
            isA: 1 as any,
            maker: TestClass.make
          }
        }
      ]
    };
    const fun = make.fromReflection(type);
    const test = TestClass.make({ a: ['a'], b: 'b' }).success();
    expect(fun(test).success()).toEqual(test);
  });

  it('fails if multiple values classes match', () => {
    const type: Type = {
      type: 'union',
      options: [
        {
          type: 'unknown'
        },
        {
          type: 'named',
          reference: {
            name: 'aa',
            definition: 1 as any,
            isA: 1 as any,
            maker: TestClass.make
          }
        },
        {
          type: 'named',
          reference: {
            name: 'aa',
            definition: 1 as any,
            isA: 1 as any,
            maker: TestClass.make
          }
        }
      ]
    };
    const fun = make.fromReflection(type);
    const test = TestClass.make({ a: ['a'], b: 'b' }).success();
    expect(fun(test).isSuccess()).toBeFalsy();
  });

  it('fails on multiple matches', () => {
    const type: Type = {
      type: 'union',
      options: [
        {
          type: 'unknown'
        },
        {
          type: 'string'
        }
      ]
    };
    const fun = make.fromReflection(type);
    expect(fun('x').isSuccess()).toBeFalsy();
  });
});

describe('string', () => {
  it('enforces minimum length if passed', () => {
    const fun = make.fromReflection({ type: 'string', minLength: 3 });
    expect(fun('a').errors[0].error).toMatch('expected a string with a length of at least');
    expect(fun('abc').isSuccess()).toBeTruthy();
    expect(fun('abcd').isSuccess()).toBeTruthy();
  });

  it('enforces maximum length if passed', () => {
    const fun = make.fromReflection({ type: 'string', maxLength: 3 });
    expect(fun('abcd').errors[0].error).toMatch('expected a string with a length of at maximum');
    expect(fun('abc').isSuccess()).toBeTruthy();
    expect(fun('a').isSuccess()).toBeTruthy();
  });

  it('rejects if the pattern does not match', () => {
    const type: Type = {
      type: 'string',
      pattern: 'a+'
    };
    const fun = make.fromReflection(type);
    expect(fun('b').errors[0].error).toEqual('b does not match pattern /a+/');
  });

  it('accepts if the pattern matches', () => {
    const type: Type = {
      type: 'string',
      pattern: 'a+'
    };
    const fun = make.fromReflection(type);
    fun('aaa').success();
  });

  it('throws on invalid regex', () => {
    const type: Type = {
      type: 'string',
      pattern: '\\'
    };
    expect(() => make.fromReflection(type)).toThrow(
      "pattern for 'type: string' is not valid: Invalid regular expression"
    );
  });

  it('rejects if format is not defined', () => {
    const type: Type = {
      type: 'string',
      format: 'some-format'
    };
    expect(() => make.fromReflection(type)).toThrow('format "some-format" is not registered.');
  });

  it('rejects if format rejects', () => {
    make.registerFormat('some-rejecting-format', () =>
      make.Make.error([{ path: [], error: 'some error' }])
    );
    const type: Type = {
      type: 'string',
      format: 'some-rejecting-format'
    };
    const fun = make.fromReflection(type);
    expect(fun('b').errors[0].error).toEqual('some error');
  });

  it('accepts if format accepts', () => {
    make.registerFormat('some-accepting-format', () => make.Make.ok(undefined));
    const type: Type = {
      type: 'string',
      format: 'some-accepting-format'
    };
    const fun = make.fromReflection(type);
    expect(fun('b').success()).toEqual('b');
  });
});

describe('intersection', () => {
  it('applies all makers to value in succession', () => {
    const type: Type = {
      type: 'intersection',
      options: [
        {
          type: 'object',
          additionalProperties: true,
          properties: { a: { required: true, value: { type: 'string' } } }
        },
        {
          type: 'object',
          additionalProperties: true,
          properties: { b: { required: true, value: { type: 'number' } } }
        }
      ]
    };
    const fun = make.fromReflection(type);
    expect(fun({ a: 'xxx', b: 1 }).success()).toEqual({ a: 'xxx', b: 1 });
  });
});

describe('unknown', () => {
  jsc.property('allows anything', jsc.json, async item => {
    const fun = make.fromReflection({ type: 'unknown' });
    expect(fun(item).success()).toEqual(item);
    if (item && typeof item === 'object') {
      expect(fun(item).success() !== item).toBeTruthy();
    }
    return true;
  });
});

describe('number', () => {
  it('enforces minimum if passed', () => {
    const fun = make.fromReflection({ type: 'number', minimum: 3 });
    expect(fun(2).errors[0].error).toMatch('expected a number greater than');
    expect(fun(3).isSuccess()).toBeTruthy();
  });
  it('enforces maximum if passed', () => {
    const fun = make.fromReflection({ type: 'number', maximum: 3 });
    expect(fun(4).errors[0].error).toMatch('expected a number smaller than');
    expect(fun(3).isSuccess()).toBeTruthy();
  });
  it('requires number to be integer', () => {
    const fun = make.fromReflection({ type: 'integer', minimum: 1 });
    expect(fun(1.5).errors[0].error).toMatch('expected an integer');
    expect(fun(123).success()).toBe(123);
  });
  it('converts string to number', () => {
    const fun1 = make.fromReflection({ type: 'number' });
    expect(fun1('123', { parseNumberStrings: true }).success()).toBe(123);
    expect(fun1('123').isError()).toBe(true);
  });
});

describe('array', () => {
  it('keeps the order', () => {
    const fun = make.fromReflection({ type: 'array', items: { type: 'string' } });
    expect(fun(['a', 'b']).success()).toEqual(['a', 'b']);
  });
  it('enforces min size if passed', () => {
    const fun = make.fromReflection({ type: 'array', items: { type: 'string' }, minItems: 3 });
    expect(fun(['a', 'b']).errors[0].error).toMatch('expected an array of minimum length');
    expect(fun(['a', 'b', 'c']).isSuccess()).toBeTruthy();
  });
  it('enforces max size if passed', () => {
    const fun = make.fromReflection({ type: 'array', items: { type: 'string' }, maxItems: 3 });
    expect(fun(['a', 'b', 'c', 'd']).errors[0].error).toMatch(
      'expected an array of maximum length'
    );
    expect(fun(['a', 'b', 'c']).isSuccess()).toBeTruthy();
  });
});

describe('object', () => {
  describe('magic fields', () => {
    it('disallows __proto__', () => {
      const properties = Object.create(null);
      properties.__proto__ = { required: true, value: { type: 'string' } };
      const fun = make.fromReflection({
        type: 'object',
        additionalProperties: false,
        properties
      });
      const value = JSON.parse(`{"__proto__": 1}`);
      expect(fun(value).errors[0].error).toEqual(
        'Using __proto__ as field of an object is not allowed'
      );
    });

    it('disallows array', () => {
      const fun = make.fromReflection({
        type: 'object',
        properties: {},
        additionalProperties: { type: 'unknown' }
      });
      expect(fun([]).errors[0].error).toEqual('expected an object, but got `[]` instead.');
    });

    it('disallows constructor', () => {
      const properties = Object.create(null);
      properties.constructor = { value: { type: 'number' }, required: true };
      const fun = make.fromReflection({ type: 'object', additionalProperties: false, properties });
      const value = JSON.parse(`{"constructor": 1}`);
      expect(fun(value).errors[0].error).toEqual(
        'Using constructor as field of an object is not allowed'
      );
    });

    it('disallows __proto__ in additionalFields', () => {
      const fun = make.fromReflection({
        type: 'object',
        properties: {},
        additionalProperties: { type: 'number' }
      });
      const value = JSON.parse(`{"__proto__": 1}`);
      expect(fun(value).errors[0].error).toEqual(
        'Using __proto__ as objects additional field is not allowed.'
      );
    });

    it('disallows constructor in additionalFields', () => {
      const fun = make.fromReflection({
        type: 'object',
        properties: {},
        additionalProperties: { type: 'number' }
      });
      const value = JSON.parse(`{"constructor": 1}`);
      expect(fun(value).errors[0].error).toEqual(
        'Using constructor as objects additional field is not allowed.'
      );
    });
  });

  it('drops unknown properties if told to', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: false,
      properties: { a: { value: { type: 'number' }, required: true } }
    });
    expect(fun({ a: 1, missing: 'a' }, { unknownField: 'drop' }).success()).toEqual({ a: 1 });
  });

  it('drops unknown properties in nested objects', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: false,
      properties: {
        a: {
          value: {
            type: 'object',
            properties: { b: { value: { type: 'number' }, required: true } },
            additionalProperties: false
          },
          required: true
        }
      }
    });
    expect(fun({ a: { b: 1, missing: 'value' } }, { unknownField: 'drop' }).success()).toEqual({
      a: { b: 1 }
    });
  });

  it('drops unknown properties in nested additional prop objects', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: { b: { value: { type: 'number' }, required: true } },
        additionalProperties: false
      },
      properties: {}
    });
    expect(fun({ a: { b: 1, missing: 'value' } }, { unknownField: 'drop' }).success()).toEqual({
      a: { b: 1 }
    });
  });

  it('disallows extra fields', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: false,
      properties: { a: { value: { type: 'number' }, required: true } }
    });
    expect(fun({ a: 1, missing: 'a' }).isError()).toBeTruthy();
  });

  it('allows fields', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: false,
      properties: { a: { value: { type: 'number' }, required: true } }
    });
    expect(fun({ a: 1 }).isSuccess()).toBeTruthy();
  });

  it('allows additional props', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: { type: 'string' },
      properties: {}
    });
    expect(fun({ a: 'xxx' }).success()).toEqual({ a: 'xxx' });
  });

  it('prefers specified field to additional props', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: { type: 'string' },
      properties: {
        a: { value: { type: 'number' }, required: true }
      }
    });
    expect(fun({ a: 1 }).success()).toEqual({ a: 1 });
  });

  it('allows undefined props', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: false,
      properties: {
        a: { value: { type: 'number' }, required: false }
      }
    });
    expect(fun({ a: undefined }).success()).toEqual({});
  });
});
