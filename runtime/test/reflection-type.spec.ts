import * as reflectionType from '../src/reflection-type';
import { ValueClass } from '../src/value-class';
import { createMakerWith, Make, makeArray, makeObject, Maker, makeString } from '../src/make';
import { pseudoRandomBytes } from 'crypto';

describe('reflection-type', () => {
  describe('Traversal', () => {
    class ArrayTestClass extends ValueClass<TestClass, 1> {
      static make(v: any): Make<ArrayTestClass> {
        return makeArrayTestClass(v);
      }
      public field!: string[];
      constructor(v: any) {
        super();
        const value = makeObject({
          field: makeArray(makeString())
        })(v).success();
        Object.assign(this, value);
      }
    }
    const makeArrayTestClass: Maker<any, ArrayTestClass> = createMakerWith(ArrayTestClass);

    class TestClass extends ValueClass<TestClass, 1> {
      static make(v: any): Make<TestClass> {
        return makeTestClass(v);
      }
      public field!: string;
      public other!: string;
      constructor(v: any) {
        super();
        const value = makeObject(
          {
            field: makeString(),
            other: makeString()
          },
          makeString()
        )(v).success();
        Object.assign(this, value);
      }
    }
    const makeTestClass: Maker<any, TestClass> = createMakerWith(TestClass);

    const target: reflectionType.NamedTypeDefinition<any> = {
      name: 'target',
      definition: {
        type: 'string'
      },
      isA: null,
      maker: 1 as any
    };
    it('allows nested named objects', () => {
      const middle: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'middle',
        isA: null,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            options: {
              value: {
                type: 'union',
                options: [{ type: 'named', reference: target }]
              },
              required: false
            }
          }
        }
      };
      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'root',
        isA: null,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            options: {
              value: {
                type: 'union',
                options: [{ type: 'named', reference: middle }]
              },
              required: false
            }
          }
        }
      };
      expect(() => reflectionType.Traversal.compile(root, target)).not.toThrow();
    });

    it('allows target at second field', () => {
      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'X',
        isA: null,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            xx: {
              value: { type: 'string' },
              required: false
            },
            field: {
              value: {
                type: 'named',
                reference: target
              },
              required: false
            }
          }
        }
      };
      expect(() => reflectionType.Traversal.compile(root, target)).not.toThrow();
    });

    it('allows singleton options', () => {
      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'X',
        isA: null,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            options: {
              value: {
                type: 'union',
                options: [{ type: 'named', reference: target }]
              },
              required: false
            }
          }
        }
      };
      expect(() => reflectionType.Traversal.compile(root, target)).not.toThrow();
    });

    it('rejects if any path is ambiguous', () => {
      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'X',
        isA: null,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            field: {
              value: { type: 'named', reference: target },
              required: false
            },
            ambiguous: {
              required: false,
              value: {
                type: 'union',
                options: [{ type: 'named', reference: target }, { type: 'string' }]
              }
            }
          }
        }
      };
      expect(() => reflectionType.Traversal.compile(root, target)).toThrow(
        /Cannot calculate unambiguous type/
      );
    });

    it('allows null options in path', () => {
      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'X',
        isA: null,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            options: {
              value: {
                type: 'union',
                options: [{ type: 'named', reference: target }, { type: 'null' }]
              },
              required: false
            }
          }
        }
      };
      expect(() => reflectionType.Traversal.compile(root, target)).not.toThrow();
    });

    it('rejects compile if there is no way from parent to lead', () => {
      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'X',
        isA: null,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            options: {
              value: { type: 'string' },
              required: false
            }
          }
        }
      };
      expect(() => reflectionType.Traversal.compile(root, target)).toThrow('no path to target');
    });

    it('rejects compile if there is options between containing parent class and leaf', () => {
      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'X',
        isA: null,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            options: {
              value: {
                type: 'union',
                options: [{ type: 'named', reference: target }, { type: 'string' }]
              },
              required: false
            }
          }
        }
      };
      expect(() => reflectionType.Traversal.compile(root, target)).toThrow(
        'Cannot calculate unambiguous type'
      );
    });

    properties('map');
    properties('pmap');

    function properties(call: 'pmap' | 'map') {
      describe('traversal with ' + call, () => {
        it('throws if given value does not match root', async () => {
          const root: reflectionType.NamedTypeDefinition<any> = {
            maker: 1 as any,
            name: 'X',
            isA: (v): v is TestClass => v instanceof TestClass,
            definition: {
              type: 'object',
              additionalProperties: false,
              properties: {
                other: {
                  value: { type: 'string' },
                  required: false
                },
                field: {
                  value: {
                    type: 'named',
                    reference: target
                  },
                  required: false
                }
              }
            }
          };
          const traverser = reflectionType.Traversal.compile(root, target);

          async function t() {
            await traverser[call](new Date(), (a: any) => a);
          }
          await expect(t()).rejects.toThrow(/Root value does not match expected root type/);
        });

        it('maps array properties', async () => {
          const root: reflectionType.NamedTypeDefinition<any> = {
            maker: 1 as any,
            name: 'X',
            isA: (v): v is TestClass => v instanceof ArrayTestClass,
            definition: {
              type: 'object',
              additionalProperties: false,
              properties: {
                field: {
                  value: {
                    type: 'array',
                    items: {
                      type: 'named',
                      reference: target
                    }
                  },
                  required: false
                }
              }
            }
          };
          const traverser = reflectionType.Traversal.compile(root, target);
          await expect(
            traverser[call](makeArrayTestClass({ field: ['abc', 'xxx'] }).success(), ((a: any) =>
              'got ' + a) as any)
          ).resolves.toEqual({
            field: ['got abc', 'got xxx']
          });
        });

        it('maps object additional properties', async () => {
          const root: reflectionType.NamedTypeDefinition<any> = {
            maker: 1 as any,
            name: 'X',
            isA: (v): v is TestClass => v instanceof TestClass,
            definition: {
              type: 'object',
              additionalProperties: { type: 'named', reference: target },
              properties: {
                field: { required: false, value: { type: 'string' } },
                other: { required: false, value: { type: 'string' } }
              }
            }
          };
          const traverser = reflectionType.Traversal.compile(root, target);
          await expect(
            traverser[call](makeTestClass({ extra: 'abc', field: 'xx', other: 'vv' }).success(), ((
              a: any
            ) => 'got ' + a) as any)
          ).resolves.toEqual({
            field: 'xx',
            extra: 'got abc',
            other: 'vv'
          });
        });

        it('maps object properties', async () => {
          const root: reflectionType.NamedTypeDefinition<any> = {
            maker: 1 as any,
            name: 'X',
            isA: (v): v is TestClass => v instanceof TestClass,
            definition: {
              type: 'object',
              additionalProperties: false,
              properties: {
                other: {
                  value: { type: 'string' },
                  required: false
                },
                field: {
                  value: {
                    type: 'named',
                    reference: target
                  },
                  required: false
                }
              }
            }
          };
          const traverser = reflectionType.Traversal.compile(root, target);
          await expect(
            traverser[call](makeTestClass({ field: 'abc', other: 'other' }).success(), ((a: any) =>
              'got ' + a) as any)
          ).resolves.toEqual({
            field: 'got abc',
            other: 'other'
          });
        });
      });
    }
  });
});
