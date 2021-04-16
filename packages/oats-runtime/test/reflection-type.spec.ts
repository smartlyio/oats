import * as runtime from '@smartlyio/oats-runtime';
import { reflection as reflectionType } from '@smartlyio/oats-runtime';
import * as fc from 'fast-check';
import { generator as gen } from '@smartlyio/oats-fast-check';
import * as testType from '../tmp/fixture.types.generated';
import safe from '@smartlyio/safe-navigation';
const { createMakerWith, makeArray, makeObject, makeString } = runtime.make;
const ValueClass = runtime.valueClass.ValueClass;
type Make<A> = runtime.make.Make<A>;
type Maker<A, R> = runtime.make.Maker<A, R>;

describe('reflection-type', () => {
  describe('Traversal', () => {
    class ArrayTestClass extends ValueClass {
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

    const makeArrayTestClass: runtime.make.Maker<any, ArrayTestClass> = createMakerWith(
      ArrayTestClass
    );

    class TestClass extends ValueClass {
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

    it('allows named arrays', () => {
      const target: reflectionType.NamedTypeDefinition<string> = {
        maker: 1 as any,
        name: 'root',
        isA: null,
        definition: {
          type: 'string'
        }
      };

      const middle: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'inner',
        isA: null,
        definition: {
          type: 'array',
          items: { type: 'named', reference: target }
        }
      };
      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'root',
        isA: ((value: any) => !!value.items) as any,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            items: {
              value: {
                type: 'named',
                reference: middle
              },
              required: true
            },
            items2: {
              value: {
                type: 'named',
                reference: middle
              },
              required: true
            }
          }
        }
      };
      const traversal = reflectionType.Traversal.compile(root, target);
      const mapped = traversal.map(
        { items: ['value'], items2: ['value2', 'value3'] },
        leaf => 'got: ' + leaf
      );
      expect(mapped.items).toEqual(['got: value']);
      expect(mapped.items2).toEqual(['got: value2', 'got: value3']);
    });

    it('allows named alieses in between', () => {
      const target: reflectionType.NamedTypeDefinition<string> = {
        maker: 1 as any,
        name: 'root',
        isA: null,
        definition: {
          type: 'string'
        }
      };

      const middle2: reflectionType.NamedTypeDefinition<unknown> = {
        maker: 1 as any,
        name: 'middle',
        isA: null,
        definition: {
          type: 'named',
          reference: target
        }
      };

      const middle: reflectionType.NamedTypeDefinition<unknown> = {
        maker: 1 as any,
        name: 'middle',
        isA: null,
        definition: {
          type: 'named',
          reference: middle2
        }
      };
      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'root',
        isA: ((value: any) => !!value.item) as any,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            item: {
              value: { type: 'named', reference: middle },
              required: false
            }
          }
        }
      };
      const traversal = reflectionType.Traversal.compile(root, target);
      const mapped = traversal.map({ item: 'value' }, leaf => 'got: ' + leaf);
      expect(mapped.item).toEqual('got: value');
    });

    it('allows arrays in inner path', () => {
      const target: reflectionType.NamedTypeDefinition<string> = {
        maker: 1 as any,
        name: 'root',
        isA: null,
        definition: {
          type: 'string'
        }
      };

      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'root',
        isA: ((value: any) => !!value.items) as any,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            items: {
              value: {
                type: 'array',
                items: { type: 'named', reference: target }
              },
              required: false
            }
          }
        }
      };
      const traversal = reflectionType.Traversal.compile(root, target);
      const mapped = traversal.map({ items: ['value'] }, leaf => 'got: ' + leaf);
      expect(mapped.items).toEqual(['got: value']);
    });

    it('allows recursive structures', () => {
      const middle: reflectionType.NamedTypeDefinition<any> = {} as any;
      Object.assign(middle, {
        maker: 1 as any,
        name: 'middle',
        isA: ((v: any) => v.middleField) as any,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            recursive: {
              value: { type: 'named', reference: middle },
              required: false
            },
            noHit: {
              value: { type: 'string' },
              required: false
            },
            middleField: {
              value: {
                type: 'union',
                options: [{ type: 'named', reference: target }]
              },
              required: false
            }
          }
        }
      });
      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'root',
        isA: ((v: any) => v.rootField) as any,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            rootField: {
              value: {
                type: 'union',
                options: [{ type: 'named', reference: middle }]
              },
              required: false
            }
          }
        }
      };
      const traversal = reflectionType.Traversal.compile(root, target);
      const mapped = traversal.map(
        {
          rootField: {
            middleField: 'value',
            noHit: 'no hit',
            recursive: { middleField: 'recursive value', noHit: 'recursive no hit' }
          }
        },
        leaf => 'got: ' + leaf
      );
      expect(mapped.rootField).toEqual({
        middleField: 'got: value',
        noHit: 'no hit',
        recursive: {
          middleField: 'got: recursive value',
          noHit: 'recursive no hit'
        }
      });
    });

    it('allows nested named objects', () => {
      const middle: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'middle',
        isA: ((v: any) => v.middleField) as any,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            middleField: {
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
        isA: ((v: any) => v.rootField) as any,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            rootField: {
              value: {
                type: 'union',
                options: [{ type: 'named', reference: middle }]
              },
              required: false
            }
          }
        }
      };
      const traversal = reflectionType.Traversal.compile(root, target);
      const mapped = traversal.map({ rootField: { middleField: 'value' } }, leaf => 'got: ' + leaf);
      expect(mapped.rootField.middleField).toEqual('got: value');
    });

    it('allows target at second field', () => {
      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'X',
        isA: ((v: any) => !!v.field) as any,
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
      const traversal = reflectionType.Traversal.compile(root, target);
      const result = traversal.map({ xx: 'xx', field: 'target' }, value => 'got ' + value);
      expect(result).toEqual({ xx: 'xx', field: 'got target' });
    });

    it('allows singleton options', () => {
      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'X',
        isA: ((v: any) => v.options) as any,
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
      const traversal = reflectionType.Traversal.compile(root, target);
      const result = traversal.map({ options: 'target' }, value => 'got ' + value);
      expect(result).toEqual({ options: 'got target' });
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
        isA: ((v: any) => v && v.hasOwnProperty('options')) as any,
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
      const traversal = reflectionType.Traversal.compile(root, target);
      const mapped = traversal.map({ options: 'value' }, leaf => 'got: ' + leaf);
      expect(mapped.options).toEqual('got: value');

      const mappedNull = traversal.map({ options: null }, leaf => 'got: ' + leaf);
      expect(mappedNull.options).toEqual(null);
    });

    it('rejects compile if nearest named thing is not an object', () => {
      const union: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'uniony',
        isA: null,
        definition: {
          type: 'union',
          options: [{ type: 'named', reference: target }]
        }
      };
      const root: reflectionType.NamedTypeDefinition<any> = {
        maker: 1 as any,
        name: 'X',
        isA: null,
        definition: {
          type: 'object',
          additionalProperties: false,
          properties: {
            options: {
              value: { type: 'named', reference: union },
              required: false
            }
          }
        }
      };
      expect(() => reflectionType.Traversal.compile(root, target)).toThrow(
        /nearest containing named thing is not an object/
      );
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

    describe('pmap and map', () => {
      properties('map');
      properties('pmap');

      it('result in the same data', () =>
        fc.assert(
          fc.asyncProperty(
            gen.named(testType.typeTestObject),
            async (value: testType.TestObject) => {
              const pmapTraverser = reflectionType.Traversal.compile(
                testType.typeTestObject,
                testType.typeTestTarget
              );
              const mapTraverser = reflectionType.Traversal.compile(
                testType.typeTestObject,
                testType.typeTestTarget
              );
              await expect(
                pmapTraverser.pmap(value, async () =>
                  testType.makeTestTarget('mapped ' + value).success()
                )
              ).resolves.toEqual(
                mapTraverser.map(value, () => testType.makeTestTarget('mapped ' + value).success())
              );
            }
          )
        ));

      function properties(call: 'pmap' | 'map') {
        async function asAsync(fn: () => any) {
          return await fn();
        }

        describe('traversal with ' + call, () => {
          const traverser = reflectionType.Traversal.compile(
            testType.typeTestObject,
            testType.typeTestTarget
          );

          it('does not set value to non targets', async () =>
            fc.assert(
              fc.asyncProperty(
                gen.named(testType.typeTestObject),
                async (value: testType.TestObject) => {
                  const original = safe(value).recursive.noHit.$;
                  const mappedValue: testType.TestObject = await traverser[call](
                    value,
                    (str: any) => ('mapped ' + str) as any
                  );
                  expect(safe(mappedValue).recursive.noHit.$).toEqual(original);
                }
              )
            ));

          it('sets value', async () =>
            fc.assert(
              fc.asyncProperty(
                gen.named(testType.typeTestObject),
                async (value: testType.TestObject) => {
                  const original = safe(value).recursive.immediate.$;
                  const mappedValue: testType.TestObject = await traverser[call](
                    value,
                    (str: any) => ('mapped ' + str) as any
                  );
                  expect(safe(mappedValue).recursive.immediate.$).toEqual(
                    original !== undefined ? 'mapped ' + original : undefined
                  );
                }
              )
            ));

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
            const result = asAsync(() => traverser[call](new Date(), (a: any) => a));
            await expect(result).rejects.toThrow(/Root value does not match expected root type/);
          });

          it('maps array properties', async () => {
            const root: reflectionType.NamedTypeDefinition<any> = {
              maker: 1 as any,
              name: 'X',
              isA: (v): v is ArrayTestClass => v instanceof ArrayTestClass,
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
            const result = asAsync(() =>
              traverser[call](
                makeArrayTestClass({ field: ['abc', 'xxx'] }).success(),
                ((a: any) => 'got ' + a) as any
              )
            );
            await expect(result).resolves.toEqual({
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
              asAsync(() =>
                traverser[call](
                  makeTestClass({ extra: 'abc', field: 'xx', other: 'vv' }).success(),
                  ((a: any) => 'got ' + a) as any
                )
              )
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
              asAsync(() =>
                traverser[call](
                  makeTestClass({ field: 'abc', other: 'other' }).success(),
                  ((a: any) => 'got ' + a) as any
                )
              )
            ).resolves.toEqual({
              field: 'got abc',
              other: 'other'
            });
          });
        });
      }
    });
  });
});
