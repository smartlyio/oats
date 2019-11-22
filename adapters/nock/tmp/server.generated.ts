import * as oar from "@smartlyio/oats-runtime";
import * as types from "./server.types.generated";
export interface Endpoints {
    readonly "/item"?: {
        readonly "post": oar.server.Endpoint<types.Headers$Item$Post, types.Parameters$Item$Post, types.Query$Item$Post, types.RequestBody$Item$Post, types.ShapeOfResponse$Item$Post>;
    };
    readonly "/item/{id}"?: {
        readonly "get": oar.server.Endpoint<types.Headers$Item$Id$Get, types.Parameters$Item$Id$Get, types.Query$Item$Id$Get, types.RequestBody$Item$Id$Get, types.ShapeOfResponse$Item$Id$Get>;
        readonly "delete": oar.server.Endpoint<types.Headers$Item$Id$Delete, types.Parameters$Item$Id$Delete, types.Query$Item$Id$Delete, types.RequestBody$Item$Id$Delete, types.ShapeOfResponse$Item$Id$Delete>;
    };
}
export interface ClientSpec {
    readonly item: {
        (id: string): {
            readonly get: oar.client.ClientEndpoint<types.Headers$Item$Id$Get, types.Query$Item$Id$Get, types.RequestBody$Item$Id$Get, types.ShapeOfResponse$Item$Id$Get>;
            readonly delete: oar.client.ClientEndpoint<types.Headers$Item$Id$Delete, types.Query$Item$Id$Delete, types.RequestBody$Item$Id$Delete, types.ShapeOfResponse$Item$Id$Delete>;
        };
        readonly post: oar.client.ClientEndpoint<types.Headers$Item$Post, types.Query$Item$Post, types.RequestBody$Item$Post, types.ShapeOfResponse$Item$Post>;
    };
}
const endpointHandlers: oar.server.Handler[] = [{
        path: "/item",
        method: "post",
        servers: ["http://localhost:12000"],
        headers: types.makeHeaders$Item$Post,
        query: types.makeQuery$Item$Post,
        body: types.makeRequestBody$Item$Post,
        params: types.makeParameters$Item$Post,
        response: types.makeResponse$Item$Post
    }, {
        path: "/item/{id}",
        method: "get",
        servers: ["http://localhost:12000"],
        headers: types.makeHeaders$Item$Id$Get,
        query: types.makeQuery$Item$Id$Get,
        body: types.makeRequestBody$Item$Id$Get,
        params: types.makeParameters$Item$Id$Get,
        response: types.makeResponse$Item$Id$Get
    }, {
        path: "/item/{id}",
        method: "delete",
        servers: ["http://localhost:12000"],
        headers: types.makeHeaders$Item$Id$Delete,
        query: types.makeQuery$Item$Id$Delete,
        body: types.makeRequestBody$Item$Id$Delete,
        params: types.makeParameters$Item$Id$Delete,
        response: types.makeResponse$Item$Id$Delete
    }];
export const router: oar.server.HandlerFactory<Endpoints> = oar.server.createHandlerFactory(endpointHandlers);
export const client: oar.client.ClientFactory<ClientSpec> = oar.client.createClientFactory(endpointHandlers);
