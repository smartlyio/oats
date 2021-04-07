/* tslint:disable variable-name only-arrow-functions*/
import * as oar from "@smartlyio/oats-runtime";
import * as types from "./types.generated";
export interface EndpointsWithContext<RequestContext> {
    readonly "/example/{id}"?: {
        readonly "get": oar.server.Endpoint<types.Headers$Example$Id$Get, types.Parameters$Example$Id$Get, types.Query$Example$Id$Get, types.RequestBody$Example$Id$Get, types.ShapeOfResponse$Example$Id$Get, RequestContext>;
        readonly "post": oar.server.Endpoint<types.Headers$Example$Id$Post, types.Parameters$Example$Id$Post, types.Query$Example$Id$Post, types.RequestBody$Example$Id$Post, types.ShapeOfResponse$Example$Id$Post, RequestContext>;
    };
}
export type Endpoints = EndpointsWithContext<void>;
export interface ClientSpec {
    readonly example: {
        (id: string): {
            readonly get: oar.client.ClientEndpoint<types.Headers$Example$Id$Get, types.Query$Example$Id$Get, types.RequestBody$Example$Id$Get, types.ShapeOfResponse$Example$Id$Get>;
            readonly post: oar.client.ClientEndpoint<types.Headers$Example$Id$Post, types.Query$Example$Id$Post, types.RequestBody$Example$Id$Post, types.ShapeOfResponse$Example$Id$Post>;
        };
    };
}
export const endpointHandlers: oar.server.Handler[] = [{
        path: "/example/{id}",
        method: "get",
        servers: ["http://localhost:12000"],
        headers: types.makeHeaders$Example$Id$Get,
        query: types.makeQuery$Example$Id$Get,
        body: types.makeRequestBody$Example$Id$Get,
        params: types.makeParameters$Example$Id$Get,
        response: types.makeResponse$Example$Id$Get
    }, {
        path: "/example/{id}",
        method: "post",
        servers: ["http://localhost:12000"],
        headers: types.makeHeaders$Example$Id$Post,
        query: types.makeQuery$Example$Id$Post,
        body: types.makeRequestBody$Example$Id$Post,
        params: types.makeParameters$Example$Id$Post,
        response: types.makeResponse$Example$Id$Post
    }];
export const router: oar.server.HandlerFactory<Endpoints> = oar.server.createHandlerFactory(endpointHandlers);
export const client: oar.client.ClientFactory<ClientSpec> = oar.client.createClientFactory(endpointHandlers);
