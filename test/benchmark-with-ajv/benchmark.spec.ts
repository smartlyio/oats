import * as server from './tmp/server/types.generated';
import * as yaml from 'js-yaml';
import { Ajv } from 'ajv';
import * as fs from 'fs';
import * as assert from 'assert';
import { Bench } from 'tinybench';

const ajv = new Ajv({ strict: false });
const schema: any = yaml.load(fs.readFileSync(__dirname + '/api.yml', 'utf8'));

function toJsonRefs(pojo: any): any {
  if (Array.isArray(pojo)) {
    return pojo.map(toJsonRefs);
  }
  if (pojo && typeof pojo == 'object') {
    return Object.fromEntries(
      Object.entries(pojo).map(([prop, body]) => {
        if (prop == '$ref') {
          assert(typeof body === 'string');
          return [prop, body.replace('#/components/schemas/', '#/definitions/')];
        }
        return [prop, toJsonRefs(body)];
      })
    );
  }
  return pojo;
}
function jsonSchemafy(topComponent: string, pojo: any) {
  const jsonSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    definitions: Object.fromEntries(
      Object.entries(pojo.components.schemas).map(([name, body]) => [name, toJsonRefs(body)])
    ),
    ...toJsonRefs(pojo.components.schemas[topComponent])
  };
  return jsonSchema;
}

function createNode(props: number, remaining: number, tag?: string) {
  if (remaining === 0) {
    return {};
  }
  const node: any = Object.fromEntries(
    new Array(props).fill(0).map((_, i) => {
      return [`prop${i}`, createNode(props, remaining - 1)];
    })
  );
  if (tag) {
    node.tag = tag;
  }
  return node;
}

function printTable(title: string, bench: Bench) {
  // eslint-disable-next-line no-console
  console.log(`# ${title}`);
  // eslint-disable-next-line no-console
  console.table(bench.table());
}
describe.each([
  { props: 100, levels: 2 },
  { props: 2, levels: 5 }
])('Against AJV with props %props, levels %levels', ({ props, levels }) => {
  it('taggedTypes bench', async () => {
    const jsonSchema = jsonSchemafy('taggedObject', schema);
    const validate = ajv.compile(jsonSchema);
    const data = createNode(props, levels, 'tag5');
    const bench = new Bench();
    bench
      .add('ajv nested types', () => {
        validate(data);
      })
      .add('oats nested types', () => {
        server.typeTaggedObjectUnion.maker(data);
      });
    await bench.warmup();
    await bench.run();
    printTable(`TaggedObjectUnion with props ${props} levels ${levels}`, bench);
  });
  it('nestedTypes bench', async () => {
    const jsonSchema = jsonSchemafy('nestedObject', schema);
    const validate = ajv.compile(jsonSchema);
    const data = createNode(props, levels);
    const bench = new Bench();
    bench
      .add('ajv nested types', () => {
        validate(data);
      })
      .add('oats nested types', () => {
        server.typeNestedObject.maker(data);
      });
    await bench.warmup();
    await bench.run();
    printTable(`NestedObject with props ${props} levels ${levels}`, bench);
  });
});
