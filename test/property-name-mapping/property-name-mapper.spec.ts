import * as types from './tmp/client/types.generated';
import * as server from './tmp/server/generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as koaAdapter from '@smartlyio/oats-koa-adapter';
import * as Koa from 'koa';
import { koaBody } from 'koa-body';
import http from 'http';
import { it, expect, afterAll, beforeAll, describe } from '@jest/globals';
import * as client from './tmp/client/generated';
import * as axiosAdapter from '@smartlyio/oats-axios-adapter';
import axios from 'axios';

describe('network ts mapping', () => {
  describe('array', () => {
    it('maps values inside arrays', () => {
      const input: any = [{ some_property: 'abc' }];
      const value = types.typeArraySchema.maker(input, { convertFromNetwork: true }).success();
      expect(runtime.serialize(value)).toEqual(input);
    });
  });
  describe('oneOf', () => {
    it('handles mixed discriminated and undiscriminated objects with string value', () => {
      const input: any = 'string value';
      const value = types.typeMixedDiscrimination
        .maker(input, { convertFromNetwork: true })
        .success();
      expect(runtime.serialize(value)).toEqual(input);
    });
    it('handles mixed discriminated and undiscriminated objects', () => {
      const input: any = { extra_value: 'one' };
      const value = types.typeMixedDiscrimination
        .maker(input, { convertFromNetwork: true })
        .success();
      expect(runtime.serialize(value)).toEqual(input);
    });

    it('handles discriminated objects', () => {
      const input: any = { prop_tag: 'one' };
      const value = types.typeDiscriminated.maker(input, { convertFromNetwork: true }).success();
      expect(runtime.serialize(value)).toEqual(input);
    });

    it('handles undiscriminated objects', () => {
      const input: any = { first_value: 'one' };
      const value = types.typeNonDiscriminatedOneOf
        .maker(input, { convertFromNetwork: true })
        .success();
      expect(runtime.serialize(value)).toEqual(input);
    });
  });
  describe('additionalProps', () => {
    it('serialized names objects as values in additionalProps', () => {
      const input: any = { some_key: { prop_tag: 'one' } };
      const value = types.typeAdditionalPropSchema
        .maker(input, { convertFromNetwork: true })
        .success();
      expect(runtime.serialize(value)).toEqual(input);
    });
  });
  describe('allOf', () => {
    it('handles allOf with multiple objects', () => {
      const input = { foo_prop: { some_prop: 'abc' }, other_prop: { other_prop_prop: 'xxx' } };
      const value = types.typeMultipleObjectsinAllOf
        .maker(input, { convertFromNetwork: true })
        .success();
      expect(runtime.serialize(value)).toEqual(input);
    });
    it('handles discriminated objects in allOf', () => {
      const input: any = { prop_tag: 'one' };
      const value = types.typeAllOfWithDiscrimination
        .maker(input, { convertFromNetwork: true })
        .success();
      expect(runtime.serialize(value)).toEqual(input);
    });
    it('checks mapped props with all branches of allOf', () => {
      const input = {
        // this is allowed by Item but not by overlapping other ThirdItem
        overlapping_property: 1,
        some_property: 'x',
        extra_second_property: 'z'
      };
      expect(types.typeAllOfSchema.maker(input, { convertFromNetwork: true }).errors).toEqual([
        {
          error: 'expected a string, but got `1` instead.',
          path: ['(allOf)', '(allOf)', 'overlappingProperty']
        }
      ]);
    });

    it('maps props', () => {
      const input = {
        overlapping_property: 'y',
        some_property: 'x',
        extra_second_property: 'z'
      };
      const value = types.typeAllOfSchema.maker(input, { convertFromNetwork: true }).success();
      expect(value).toEqual({
        extraSecondProperty: input.extra_second_property,
        someProperty: input.some_property,
        overlappingProperty: input.overlapping_property
      });
      const serialized = runtime.serialize(value);
      expect(serialized).toEqual(input);
    });
    it('forgets about mapping from previous make', () => {
      const previousValue = types.typeObjectWithSpecifiedField
        .maker({ field: { fooBar: 'a' } })
        .success();
      const value = types.typeObjectWithAnyField.maker(previousValue).success();
      expect(runtime.serialize(value)).toEqual({ field: { fooBar: 'a' } });
    });
    it('remembers mapping within allOf', () => {
      const value = types.typeAllOfWithAny.maker({ field: { fooBar: 'a' } }).success();
      expect(runtime.serialize(value)).toEqual({ field: { foo_bar: 'a' } });
    });
    it('maps props in nested objects', () => {
      const input = {
        prop: {
          first_nested: 'y',
          second_nested: 'x',
          nested_named_prop: 'z'
        }
      };
      const value = types.typeSchemaWithNestedObjects
        .maker(input, { convertFromNetwork: true })
        .success();
      expect(value).toEqual({
        prop: {
          firstNested: input.prop.first_nested,
          secondNested: input.prop.second_nested,
          nestedNamedProp: input.prop.nested_named_prop
        }
      });
      expect(runtime.getType(value.prop!)).toHaveLength(3);
      expect(runtime.getType(value.prop!)).toEqual(
        expect.arrayContaining([
          types.typeNestedNamed.definition,
          expect.objectContaining({
            properties: expect.objectContaining({ firstNested: expect.anything() })
          }),
          expect.objectContaining({
            properties: expect.objectContaining({ secondNested: expect.anything() })
          })
        ])
      );
      const serialized = runtime.serialize(value);
      expect(serialized).toEqual(input);
    });
  });
  describe('mapping works', () => {
    it('maps inputs but not additional props', async () => {
      const p = types.typeItem
        .maker({ some_property: 'x', extra_property: 'y' } as any, { convertFromNetwork: true })
        .success();
      expect(p.extra_property).toEqual('y');
    });

    it('maps inputs', async () => {
      const p = types.typeItem
        .maker({ some_property: 'x' } as any, { convertFromNetwork: true })
        .success();
      expect(p.someProperty).toEqual('x');
    });

    it('does not map input unnecessarily', async () => {
      const p = types.typeItem.maker({ someProperty: 'x' }).success();
      expect(p.someProperty).toEqual('x');
    });

    it('serializes object values', async () => {
      const value = types.typeItem.maker({ someProperty: 'x' }).success();
      const serialized = runtime.serialize(value);
      expect(serialized.some_property).toEqual('x');
    });
  });
  describe('integration test', () => {
    const requestParam = 'request path param';
    const replyHeader = 'reply header';
    const requestHeaderItem = 'request header item';
    const someQueryItem = 'some query item';
    const requestItem: types.ShapeOfItem = {
      someProperty: 'some property of item',
      extraProp: { extraNestedObjectProp: 'xxnn' }
    };
    const replyItem: types.ShapeOfItem = { someProperty: 'some reply property of item' };

    const spec: server.Endpoints = {
      '/item/{some_item}': {
        post: async ctx => {
          expect(ctx.query.someQueryItem).toEqual(someQueryItem);
          expect(ctx.headers.headerItem).toEqual(requestHeaderItem);
          expect(ctx.params.someItem).toEqual(requestParam);
          expect(ctx.body.value).toEqual(requestItem);
          return runtime.setHeaders(runtime.json(200, replyItem), {
            // todo: map reply header types
            replyHeader: replyHeader
          });
        }
      }
    };

    function createRoutes() {
      return koaAdapter.bind({
        handler: runtime.server.createHandlerFactory<server.Endpoints>(server.endpointHandlers),
        spec
      });
    }

    function createApp() {
      const app = new Koa();
      app.use(
        koaBody({
          multipart: true
        })
      );
      app.use(createRoutes().routes());
      return app;
    }

    function serverPort(server: http.Server) {
      return serverAddress(server).split(/:/)[2] || 80;
    }

    function serverAddress(server: http.Server) {
      const addr = server.address();
      if (typeof addr === 'string') {
        return addr;
      } else if (!addr) {
        throw new Error('missing server address');
      }

      return `http://localhost:${addr.port}`;
    }

    describe('Koa adapter', () => {
      let apiClient: client.ClientSpec;
      let httpServer: http.Server | undefined;
      let url: string;

      afterAll(() => {
        httpServer?.close();
      });

      beforeAll(async () => {
        httpServer = await new Promise<http.Server>(resolve => {
          const httpServer = createApp().listen(0, () => resolve(httpServer));
        });
        const port = serverPort(httpServer);
        url = `http://localhost:${port}`;

        apiClient = client.client(spec => {
          return axiosAdapter.create()({ ...spec, servers: [url] });
        });
      });

      it('maps everything', async () => {
        const p = await apiClient.item(requestParam).post({
          headers: { headerItem: requestHeaderItem },
          body: runtime.client.json(requestItem),
          query: { someQueryItem }
        });
        expect(p.value.value).toEqual(replyItem);
        expect(p.headers.replyHeader).toEqual(replyHeader);
      });

      it('server maps correctly', async () => {
        const p = await axios.post(
          `${url}/item/${requestParam}?some_query_item=${someQueryItem}`,
          {
            some_property: requestItem.someProperty,
            extra_prop: { extra_nested_object_prop: requestItem.extraProp!.extraNestedObjectProp }
          },
          {
            headers: { header_item: requestHeaderItem }
          }
        );
        expect(p.data).toEqual({ some_property: replyItem.someProperty });
        expect(p.headers['reply_header']).toEqual(replyHeader);
      });
    });
  });
});
