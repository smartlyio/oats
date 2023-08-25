import * as make from '../src/make';
import * as jsc from 'jsverify';
import { TestClass } from './test-class';
import * as classWithAdditional from './test-class-with-additional-props';
import { Type } from '../src/reflection-type';
import { serialize } from '../src/serialize';
import { getType, withType } from '../src/type-tag';
import { File, FormBinary } from '../src/make';

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
            reference: () => ({
              name: 'a',
              isA: 1 as any,
              maker: 1 as any,
              definition: {
                type: 'string',
                enum: ['a']
              }
            })
          },
          required: true
        }
      }
    };
    const btype: Type = {
      type: 'named',
      reference: () => ({
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
      })
    };
    const fun = make.fromReflection({ type: 'union', options: [atype, btype] });
    expect(fun({ tag: 'b' }).success()).toEqual({ tag: 'b' });
  });

  it('handles enums with falsy values as discriminators', () => {
    const atype: Type = {
      type: 'union',
      options: [
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: {
              value: {
                type: 'string'
              },
              required: true
            },
            enabled: {
              value: {
                type: 'boolean',
                enum: [false]
              },
              required: true
            }
          }
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            other_name: {
              value: {
                type: 'string'
              },
              required: true
            },
            enabled: {
              value: {
                type: 'boolean',
                enum: [true]
              },
              required: true
            }
          }
        }
      ]
    };
    const fun = make.fromReflection(atype);
    expect(fun({ enabled: false, name: 'aaa' }).success()).toEqual({ enabled: false, name: 'aaa' });
    expect(fun({ enabled: true, other_name: 'aaa' }).success()).toEqual({
      enabled: true,
      other_name: 'aaa'
    });
  });
});

describe('named', () => {
  it('uses the maker from name', () => {
    const type: Type = {
      type: 'named',
      reference: () => ({
        name: 'aa',
        definition: 1 as any,
        isA: 1 as any,
        maker: make.fromReflection({ type: 'string' })
      })
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
          reference: () => ({
            name: 'aa',
            definition: 1 as any,
            isA: 1 as any,
            maker: TestClass.make
          })
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
          reference: () => ({
            name: 'aa',
            definition: 1 as any,
            isA: 1 as any,
            maker: TestClass.make
          })
        },
        {
          type: 'named',
          reference: () => ({
            name: 'aa',
            definition: 1 as any,
            isA: 1 as any,
            maker: TestClass.make
          })
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

  it('accepts if format is not defined', () => {
    const type: Type = {
      type: 'string',
      format: 'some-format'
    };
    const fun = make.fromReflection(type);
    fun('b').success();
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

class SomeClass {
  a = 1;
}
describe('unknown', () => {
  it('redoes value classes', async () => {
    const fun = make.fromReflection({ type: 'unknown' });
    const item = new TestClass({ a: ['a'], b: 'b' });
    expect(fun(item).success()).toEqual(item);
    expect(fun(item).success() !== item).toBeTruthy();
  });
  it('keeps Buffer instances', async () => {
    const fun = make.fromReflection({ type: 'unknown' });
    const item = Buffer.alloc(1, 'x', 'utf-8');
    expect(fun(item).success()).toEqual(item);
    expect(fun(item).success() === item).toBeTruthy();
  });
  it('keeps File instances', async () => {
    const fun = make.fromReflection({ type: 'unknown' });
    const item = new File('path', 10, 'name');
    expect(fun(item).success()).toEqual(item);
    expect(fun(item).success() === item).toBeTruthy();
  });
  it('keeps FormBinary instances', async () => {
    const fun = make.fromReflection({ type: 'unknown' });
    const item = new FormBinary({ binary: Buffer.alloc(1, 'x', 'utf-8') });
    expect(fun(item).success()).toEqual(item);
    expect(fun(item).success() === item).toBeTruthy();
  });
  it('keeps FormBinary instances', async () => {
    const fun = make.fromReflection({ type: 'unknown' });
    const item = new FormBinary({ binary: Buffer.alloc(1, 'x', 'utf-8') });
    expect(fun(item).success()).toEqual(item);
    expect(fun(item).success() === item).toBeTruthy();
  });
  it('keeps custom instances', async () => {
    const fun = make.fromReflection({ type: 'unknown' });
    const item = new SomeClass();
    expect(fun(item).success()).toEqual(item);
    expect(fun(item).success() === item).toBeTruthy();
  });
  it('keeps instances', async () => {
    const fun = make.fromReflection({ type: 'unknown' });
    const item = new Date();
    expect(fun(item).success()).toEqual(item);
    expect(fun(item).success() === item).toBeTruthy();
  });

  it('loses deep reflection types', async () => {
    const fun = make.fromReflection({ type: 'unknown' });
    const item = [{ prop: withType({}, [{ type: 'boolean' }]) }];
    expect(item[0].prop).not.toEqual(undefined);
    expect(fun(item).success()).toEqual(item);
    expect(getType(fun(item[0].prop))).toEqual(undefined);
  });

  it('loses reflection types', async () => {
    const fun = make.fromReflection({ type: 'unknown' });
    const item = withType({}, [{ type: 'boolean' }]);
    expect(item).not.toEqual(undefined);
    expect(fun(item).success()).toEqual(item);
    expect(getType(fun(item))).toEqual(undefined);
  });

  jsc.property('allows anything', jsc.json, async item => {
    const fun = make.fromReflection({ type: 'unknown' });
    expect(fun(item).success()).toEqual(item);
    return true;
  });
});

describe('boolean', () => {
  it('validates value is a boolean', () => {
    const fun = make.fromReflection({ type: 'boolean' });
    for (const nonBoolean of [undefined, null, 0, 1, NaN, {}]) {
      expect(fun(nonBoolean).errors[0].error).toMatch('expected a boolean');
    }
    expect(fun(true).success()).toBe(true);
    expect(fun(false).success()).toBe(false);
  });
  it('converts a string to a boolean', () => {
    const fun = make.fromReflection({ type: 'boolean' });
    for (const value of [false, true]) {
      expect(fun(String(value)).isError()).toBe(true);
      expect(fun(String(value), { parseBooleanStrings: true }).success()).toBe(value);
    }
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
  it('converts a string to a number', () => {
    const fun1 = make.fromReflection({ type: 'number' });
    expect(fun1('123.5', { parseNumericStrings: true }).success()).toBe(123.5);
    expect(fun1('123.5').isError()).toBe(true);

    const fun2 = make.fromReflection({ type: 'integer' });
    expect(fun2('123', { parseNumericStrings: true }).success()).toBe(123);
    expect(fun2('123').isError()).toBe(true);

    for (const invalid of ['1x', 'NaN', 'Infinity', '', ' \t\r\n']) {
      expect(fun1(invalid).isError()).toBe(true);
      expect(fun2(invalid).isError()).toBe(true);
    }
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
  it('supports `allowConvertForArrayType`', () => {
    const fun = make.fromReflection({ type: 'array', items: { type: 'integer' } });
    expect(fun(123).errors[0].error).toMatch('expected an array, but got `123` instead.');
    expect(fun(123, { allowConvertForArrayType: true }).success()).toEqual([123]);
  });
  it('works for "string | array" type with `allowConvertForArrayType`', () => {
    const fun1 = make.fromReflection({
      type: 'union',
      options: [
        {
          type: 'string'
        },
        {
          type: 'array',
          items: { type: 'string' }
        }
      ]
    });
    expect(fun1(['abc'], { allowConvertForArrayType: true }).success()).toEqual(['abc']);
    expect(fun1('abc', { allowConvertForArrayType: true }).errors[0].error).toMatch(
      'multiple options match'
    );
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

  describe('getType', () => {
    it('returns undefined for falsys', () => {
      const type: Type = {
        type: 'null'
      };
      const fun = make.fromReflection(type);
      expect(getType(fun(null).success())).toEqual(undefined);
    });

    it('returns undefined for non-objects', () => {
      const type: Type = {
        type: 'array',
        items: {
          type: 'unknown'
        }
      };
      const fun = make.fromReflection(type);
      expect(getType(fun([]).success())).toEqual(undefined);
    });

    describe('oneOf', () => {
      it('returns the type used for construction', () => {
        const type1: Type = {
          type: 'object',
          properties: { a: { value: { type: 'number' }, required: true } },
          additionalProperties: true
        };
        const type2: Type = {
          type: 'object',
          properties: { b: { value: { type: 'number' }, required: true } },
          additionalProperties: true
        };
        const oneOf: Type = {
          type: 'union',
          options: [type1, type2]
        };
        const fun = make.fromReflection(oneOf);
        const gotType = getType(fun({ a: 1 }).success());
        expect(gotType).toEqual([type1]);
      });
    });

    describe('allOf', () => {
      it('returns the type used for construction', () => {
        const type1: Type = {
          type: 'object',
          properties: { a: { value: { type: 'number' }, required: true } },
          additionalProperties: true
        };
        const type2: Type = {
          type: 'object',
          properties: { b: { value: { type: 'number' }, required: true } },
          additionalProperties: true
        };
        const allOf: Type = {
          type: 'intersection',
          options: [type1, type2]
        };
        const fun = make.fromReflection(allOf);
        const gotType = getType(fun({ a: 1, b: 1 }).success());
        expect(gotType).toHaveLength(2);
        expect(gotType).toEqual(expect.arrayContaining([type1, type2]));
      });

      it('returns the type for value class', () => {
        const type: Type = {
          type: 'object',
          properties: { c: { value: { type: 'string' }, required: true } },
          additionalProperties: true
        };
        const allOf: Type = {
          type: 'intersection',
          options: [{ type: 'named', reference: () => classWithAdditional.named }, type]
        };
        const input = { a: [], b: 'a', c: 'other value' };
        const fun = make.fromReflection(allOf);
        const madeValue = fun(input).success();
        expect(getType(madeValue)).toEqual(
          expect.arrayContaining([classWithAdditional.TestClass.reflection().definition, type])
        );
        expect(madeValue).toEqual(input);
      });
    });

    it('returns the type used for construction', () => {
      const type: Type = {
        type: 'object',
        additionalProperties: false,
        properties: { a: { value: { type: 'number' }, required: true } }
      };
      const fun = make.fromReflection(type);
      expect(getType(fun({ a: 1 }).success())).toEqual([type]);
    });

    it('returns the type for value class', () => {
      const value = TestClass.make({ a: [], b: 'a' }).success();
      expect(getType(value)).toEqual([TestClass.reflection().definition]);
    });
  });

  describe('work avoidance', () => {
    it('returns the input value when reparsing', () => {
      const fun = make.fromReflection({
        type: 'object',
        additionalProperties: false,
        properties: { field: { value: { type: 'number' }, required: true, networkName: 'network' } }
      });
      const value = fun({ field: 1 }).success();
      expect(fun(value).success()).toBe(value);
    });
  });
  describe('property mapping', () => {
    it('map properties from network to ts side', () => {
      const fun = make.fromReflection({
        type: 'object',
        additionalProperties: false,
        properties: { ts: { value: { type: 'number' }, required: true, networkName: 'network' } }
      });
      const value = fun({ network: 1 }, { convertFromNetwork: true }).success();
      expect(value).toEqual({ ts: 1 });
      expect(serialize(value)).toEqual({ network: 1 });
    });

    it('maps arrays', () => {
      const fun = make.fromReflection({
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: { ts: { value: { type: 'number' }, required: true, networkName: 'network' } }
        }
      });
      const value = fun([{ network: 1 }], { convertFromNetwork: true }).success();
      expect(value).toEqual([{ ts: 1 }]);
      expect(serialize(value)).toEqual([{ network: 1 }]);
    });

    it('does not do anything with scalars', () => {
      const fun = make.fromReflection({
        type: 'string'
      });
      const value = fun('abc', { convertFromNetwork: true }).success();
      expect(value).toEqual('abc');
      expect(serialize(value)).toEqual('abc');
    });

    it('does not do anything with nulls', () => {
      const fun = make.fromReflection({
        type: 'null'
      });
      const value = fun(null, { convertFromNetwork: true }).success();
      expect(value).toEqual(null);
      expect(serialize(value)).toEqual(null);
    });

    it('does not map properties without the flag', () => {
      const fun = make.fromReflection({
        type: 'object',
        additionalProperties: false,
        properties: {
          ts: { value: { type: 'number' }, required: true, networkName: 'network' }
        }
      });
      expect(fun({ network: 1 }, {}).errors[0]).toEqual(expect.objectContaining({ path: ['ts'] }));
    });

    it('does not map additionalProperties', () => {
      const fun = make.fromReflection({
        type: 'object',
        additionalProperties: true,
        properties: { ts: { value: { type: 'number' }, required: true, networkName: 'network' } }
      });
      expect(fun({ network: 1, foo: 2 }, { convertFromNetwork: true }).success()).toEqual({
        ts: 1,
        foo: 2
      });
    });

    it('does not overwrite with additionalProps', () => {
      const fun = make.fromReflection({
        type: 'object',
        additionalProperties: true,
        properties: { ts: { value: { type: 'number' }, required: true, networkName: 'network' } }
      });
      expect(fun({ network: 1, ts: 2 }, { convertFromNetwork: true }).success()).toEqual({
        ts: 1
      });
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

  it('does not remove undefined props when additionalProps true', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: true,
      properties: {}
    });
    expect(Object.keys(fun({ a: undefined }).success())).toEqual(['a']);
  });

  it('removes undefined props when additionalProps is a type', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: { type: 'string' },
      properties: {}
    });
    expect(Object.keys(fun({ a: undefined }).success())).toEqual([]);
  });

  it('removes unknown undefined props when additionalProps is false', () => {
    const fun = make.fromReflection({
      type: 'object',
      additionalProperties: false,
      properties: {}
    });
    expect(Object.keys(fun({ a: undefined }).success())).toEqual([]);
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
