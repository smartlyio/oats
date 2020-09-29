import * as fc from 'fast-check';
import { reflection } from '@smartlyio/oats-runtime';
import * as assert from 'assert';
import * as _ from 'lodash';
import * as randexp from 'randexp';

export class GenType extends fc.Arbitrary<any> {
  private generator: fc.Arbitrary<any> | undefined;
  constructor(private readonly type: reflection.Type, private readonly bias?: number) {
    super();
  }

  withBias(freq: number): fc.Arbitrary<any> {
    return freq === this.bias ? this : new GenType(this.type, freq);
  }

  generate(mrng: fc.Random): fc.Shrinkable<any> {
    if (!this.generator) {
      this.generator = this.makeGenerator();
      if (this.bias !== undefined) {
        this.generator = this.generator.withBias(this.bias);
      }
    }
    return this.generator.generate(mrng);
  }

  private makeGenerator() {
    const type = this.type;
    if (type.type === 'string') {
      if (type.enum) {
        return fc.oneof(...type.enum.map(fc.constant));
      }
      if (type.pattern) {
        const gen = new randexp(type.pattern);
        return fc
          .integer()
          .map(() => {
            return gen.gen();
          })
          .noShrink();
      }
      return fc.hexaString();
    }
    if (type.type === 'integer') {
      if (type.enum) {
        return fc.oneof(...type.enum.map(fc.constant));
      }
      return fc.integer();
    }
    if (type.type === 'number') {
      if (type.enum) {
        return fc.oneof(...type.enum.map(fc.constant));
      }
      return fc.float().map(v => 1000 * v);
    }
    if (type.type === 'array') {
      return fc.array(new GenType(type.items));
    }
    if (type.type === 'union') {
      return fc.oneof(...type.options.map(option => new GenType(option)));
    }
    if (type.type === 'intersection') {
      // todo: need to create all values and then merge them
      assert.fail('todo intersection value generation');
    }
    if (type.type === 'named') {
      return named(type.reference);
    }
    if (type.type === 'null') {
      return fc.constant(null);
    }
    if (type.type === 'unknown') {
      return fc.anything();
    }
    if (type.type === 'object') {
      return new GenObject(type.properties, type.additionalProperties);
    }
    if (type.type === 'boolean') {
      if (type.enum) {
        return fc.oneof(...type.enum.map(fc.constant));
      }
      return fc.boolean();
    }
    return assert.fail('todo arb for missing type ' + type);
  }
}

class GenObject extends fc.Arbitrary<any> {
  private generator: fc.Arbitrary<any> | undefined;
  constructor(
    private readonly props: reflection.Props,
    private readonly additionalProperties: reflection.AdditionalProp,
    private readonly bias?: number
  ) {
    super();
  }

  withBias(freq: number): fc.Arbitrary<any> {
    return freq === this.bias ? this : new GenObject(this.props, this.additionalProperties, freq);
  }

  generate(mrng: fc.Random): fc.Shrinkable<any> {
    if (!this.generator) {
      this.generator = this.makeGenerator();
      if (this.bias !== undefined) {
        this.generator = this.generator.withBias(this.bias);
      }
    }
    return this.generator.generate(mrng);
  }

  private isScalar(type: string) {
    return ['boolean', 'integer', 'string', 'number'].indexOf(type) >= 0;
  }

  private onlyScalars(fields: string[]) {
    return fields.filter(field => {
      const type = this.props[field];
      return type && this.isScalar(type.value.type);
    });
  }
  private orderOptionals(fields: string[]) {
    const scalars = this.onlyScalars(fields);
    const nonScalars = fields.filter(field => {
      const type = this.props[field];
      return !type || !this.isScalar(type.value.type);
    });
    return [...scalars, ...nonScalars];
  }

  private makeGenerator() {
    const required = Object.keys(this.props).filter(prop => this.props[prop].required);
    const optional = Object.keys(this.props).filter(prop => !this.props[prop].required);
    const smaller = this.bias ? Math.max(this.bias - 1, 1) : 1;
    const additionalFieldNames = this.additionalProperties
      ? fc.array(fc.hexaString()).withBias(smaller)
      : fc.constant([]);
    const generators: { [key: string]: fc.Arbitrary<any> } = {};
    [...required, ...optional].forEach(field => {
      generators[field] = new GenType(this.props[field].value);
    });
    const additionalGenerator =
      this.additionalProperties === true
        ? fc.anything()
        : this.additionalProperties
        ? new GenType(this.additionalProperties)
        : fc.anything();
    return additionalFieldNames
      .noShrink()
      .chain(additionalFields => {
        let fields = this.orderOptionals([...optional, ...additionalFields]);
        if (smaller < 2) {
          fields = this.onlyScalars(fields);
        }
        return fc.subarray(fields).withBias(smaller);
      })
      .noShrink()
      .chain(optFields => {
        const allFields = _.uniq([...required, ...optFields]);
        const object: { [key: string]: fc.Arbitrary<any> } = {};
        allFields.forEach(field => {
          object[field] = generators[field] || additionalGenerator;
        });
        return new OptRecord(required, object).withBias(smaller);
      });
  }
}

function fullRecordShrinker(
  value: Record<string, any>,
  shrinkable: Record<string, fc.Shrinkable<any>>
) {
  return new fc.Shrinkable(value, () => {
    const shrinked: fc.Shrinkable<any>[] = Object.keys(shrinkable).map(key => {
      return new fc.Shrinkable(value, () =>
        shrinkable[key]
          .shrink()
          .map(keyValue => {
            return fullRecordShrinker(
              { ...value, [key]: keyValue.value },
              { ...shrinkable, [key]: keyValue }
            );
          })
          .join([fullRecordShrinker(value, _.omit(shrinkable, key))].values())
      );
    });
    return fc.Stream.nil<fc.Shrinkable<any>>().join(shrinked.values());
  });
}

function optRecordShrinker(required: string[], record: Record<string, fc.Shrinkable<any>>) {
  const value: Record<string, any> = {};
  Object.keys(record).forEach(key => {
    value[key] = record[key].value;
  });
  const optionalValues = Object.keys(record).filter(key => required.indexOf(key) < 0);
  return new fc.Shrinkable(value, () => {
    const filtered: fc.Shrinkable<any>[] = optionalValues.map(key => {
      return optRecordShrinker(required, _.omit(record, key));
    });
    return fc.Stream.nil<fc.Shrinkable<any>>().join(
      [...filtered, fullRecordShrinker(value, record)].values()
    );
  });
}

class OptRecord extends fc.Arbitrary<any> {
  constructor(
    private readonly required: string[],
    private readonly record: Record<string, fc.Arbitrary<any>>,
    private readonly bias?: number
  ) {
    super();
    if (bias) {
      Object.keys(this.record).forEach(key => {
        this.record[key] = this.record[key].withBias(bias);
      });
    }
  }
  withBias(freq: number): fc.Arbitrary<any> {
    if (freq !== this.bias) {
      return new OptRecord(this.required, this.record, freq);
    }
    return this;
  }

  generate(mrng: fc.Random): fc.Shrinkable<any> {
    const shrinks: Record<string, fc.Shrinkable<any>> = {};
    Object.keys(this.record).forEach(key => {
      shrinks[key] = this.record[key].generate(mrng);
    });
    return optRecordShrinker(this.required, shrinks);
  }
}

// we need this for handling recursive definitions.
// note: key is the identity of the definition object so should be unique
const namedGeneratorCache: Map<reflection.NamedTypeDefinition<any>, fc.Arbitrary<any>> = new Map();

export function override<A>(name: reflection.NamedTypeDefinition<A>, override: fc.Arbitrary<A>) {
  namedGeneratorCache.set(name, override);
}

export function clear(name: reflection.NamedTypeDefinition<any>) {
  namedGeneratorCache.delete(name);
}

export function named<A>(name: reflection.NamedTypeDefinition<A>): fc.Arbitrary<A> {
  const existing = namedGeneratorCache.get(name);
  if (existing) {
    return existing;
  }
  const newGen = new GenNamed(name);
  namedGeneratorCache.set(name, newGen);
  return newGen;
}

class GenNamed<A> extends fc.Arbitrary<A> {
  private generator: fc.Arbitrary<A> | undefined;
  constructor(
    private readonly named: reflection.NamedTypeDefinition<A>,
    private readonly bias?: number
  ) {
    super();
  }
  withBias(freq: number): fc.Arbitrary<A> {
    return freq === this.bias ? this : new GenNamed(this.named, freq);
  }

  generate(mrng: fc.Random): fc.Shrinkable<A> {
    if (!this.generator) {
      this.generator = new GenType(this.named.definition);
      if (this.bias !== undefined) {
        this.generator = this.generator.withBias(this.bias);
      }
    }
    return this.generator.generate(mrng).map(object => this.named.maker(object).success());
  }
}
