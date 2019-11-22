import * as oar from "@smartlyio/oats-runtime";
import * as types from "./client.types.generated";
export interface Endpoints {
    readonly "/item"?: {
        readonly "post": oar.server.Endpoint<types.ShapeOfHeaders$Item$Post, types.ShapeOfParameters$Item$Post, types.ShapeOfQuery$Item$Post, types.ShapeOfRequestBody$Item$Post, types.Response$Item$Post>;
    };
    readonly "/item/{id}"?: {
        readonly "get": oar.server.Endpoint<types.ShapeOfHeaders$Item$Id$Get, types.ShapeOfParameters$Item$Id$Get, types.ShapeOfQuery$Item$Id$Get, types.ShapeOfRequestBody$Item$Id$Get, types.Response$Item$Id$Get>;
        readonly "delete": oar.server.Endpoint<types.ShapeOfHeaders$Item$Id$Delete, types.ShapeOfParameters$Item$Id$Delete, types.ShapeOfQuery$Item$Id$Delete, types.ShapeOfRequestBody$Item$Id$Delete, types.Response$Item$Id$Delete>;
    };
}
export interface ClientSpec {
    readonly item: {
        (id: string): {
            readonly get: oar.client.ClientEndpoint<types.ShapeOfHeaders$Item$Id$Get, types.ShapeOfQuery$Item$Id$Get, types.ShapeOfRequestBody$Item$Id$Get, types.Response$Item$Id$Get>;
            readonly delete: oar.client.ClientEndpoint<types.ShapeOfHeaders$Item$Id$Delete, types.ShapeOfQuery$Item$Id$Delete, types.ShapeOfRequestBody$Item$Id$Delete, types.Response$Item$Id$Delete>;
        };
        readonly post: oar.client.ClientEndpoint<types.ShapeOfHeaders$Item$Post, types.ShapeOfQuery$Item$Post, types.ShapeOfRequestBody$Item$Post, types.Response$Item$Post>;
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
