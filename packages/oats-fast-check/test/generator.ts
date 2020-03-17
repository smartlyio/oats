import * as fc from 'fast-check';
import * as reflection from '../src/reflection-type';
import * as assert from 'assert';
import * as _ from 'lodash';

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
    const smaller = this.bias ? this.bias - 1 : 1;
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
      .chain(additionalFields => {
        let fields = this.orderOptionals([...optional, ...additionalFields]);
        if (smaller < 2) {
          fields = this.onlyScalars(fields);
        }
        return fc.subarray(fields).withBias(smaller);
      })
      .chain(optFields => {
        const allFields = _.uniq([...required, ...optFields]);
        const object: { [key: string]: fc.Arbitrary<any> } = {};
        allFields.forEach(field => {
          object[field] = generators[field] || additionalGenerator;
        });
        return fc.record(object).withBias(smaller);
      });
  }
}

// we need this for handling recursive definitions.
// note: key is the identity of the definition object so should be unique
const namedGeneratorCache: Map<reflection.NamedTypeDefinition<any>, GenNamed<any>> = new Map();

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
      this.generator = new GenType(this.named.definition).map(object =>
        this.named.maker(object).success()
      );
      if (this.bias !== undefined) {
        this.generator = this.generator.withBias(this.bias);
      }
    }
    return this.generator.generate(mrng);
  }
}
