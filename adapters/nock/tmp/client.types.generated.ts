/* tslint:disable variable-name only-arrow-functions*/
import * as oar from "@smartlyio/oats-runtime";
import * as common from "./common.types.generated";
export interface ShapeOfError {
    readonly message: string;
    readonly [key: string]: unknown;
}
enum BrandOfError {
}
export class Error extends oar.valueClass.ValueClass<ShapeOfError, BrandOfError> implements ShapeOfError {
    readonly message!: string;
    readonly [instanceIndexSignatureKey: string]: unknown;
    public constructor(value: ShapeOfError, opts?: oar.make.MakeOptions) { super(); Object.assign(this, buildError(value, opts).success()); }
    static make(value: ShapeOfError, opts?: oar.make.MakeOptions): oar.make.Make<Error> { return makeError(value, opts); }
}
export const buildError: oar.make.Maker<ShapeOfError, ShapeOfError> = oar.make.createMaker(function () { return oar.make.makeObject({
    message: oar.make.makeString()
}, oar.make.makeAny()); });
export const makeError: oar.make.Maker<ShapeOfError, Error> = oar.make.createMakerWith(Error);
export type NoContent = {
    readonly contentType: "text/plain";
    readonly value: string;
};
export type ShapeOfNoContent = {
    readonly contentType: "text/plain";
    readonly value: string;
};
export const makeNoContent: oar.make.Maker<ShapeOfNoContent, NoContent> = oar.make.createMaker(function () { return oar.make.makeOneOf(oar.make.makeObject({
    contentType: oar.make.makeEnum("text/plain"),
    value: oar.make.makeString()
})); });
export type PostBody = {
    readonly contentType: "application/json";
    readonly value: common.Item;
};
export type ShapeOfPostBody = {
    readonly contentType: "application/json";
    readonly value: common.ShapeOfItem;
};
export const makePostBody: oar.make.Maker<ShapeOfPostBody, PostBody> = oar.make.createMaker(function () { return oar.make.makeOneOf(oar.make.makeObject({
    contentType: oar.make.makeEnum("application/json"),
    value: common.makeItem
})); });
export type Query$Item$Post = void;
export type ShapeOfQuery$Item$Post = void;
export const makeQuery$Item$Post: oar.make.Maker<ShapeOfQuery$Item$Post, Query$Item$Post> = oar.make.createMaker(function () { return oar.make.makeVoid(); });
export interface ShapeOfHeaders$Item$Post {
    readonly authorization: string;
}
enum BrandOfHeaders$Item$Post {
}
export class Headers$Item$Post extends oar.valueClass.ValueClass<ShapeOfHeaders$Item$Post, BrandOfHeaders$Item$Post> implements ShapeOfHeaders$Item$Post {
    readonly authorization!: string;
    public constructor(value: ShapeOfHeaders$Item$Post, opts?: oar.make.MakeOptions) { super(); Object.assign(this, buildHeaders$Item$Post(value, opts).success()); }
    static make(value: ShapeOfHeaders$Item$Post, opts?: oar.make.MakeOptions): oar.make.Make<Headers$Item$Post> { return makeHeaders$Item$Post(value, opts); }
}
export const buildHeaders$Item$Post: oar.make.Maker<ShapeOfHeaders$Item$Post, ShapeOfHeaders$Item$Post> = oar.make.createMaker(function () { return oar.make.makeObject({
    authorization: oar.make.makeString()
}); });
export const makeHeaders$Item$Post: oar.make.Maker<ShapeOfHeaders$Item$Post, Headers$Item$Post> = oar.make.createMakerWith(Headers$Item$Post);
export type Parameters$Item$Post = void;
export type ShapeOfParameters$Item$Post = void;
export const makeParameters$Item$Post: oar.make.Maker<ShapeOfParameters$Item$Post, Parameters$Item$Post> = oar.make.createMaker(function () { return oar.make.makeVoid(); });
export type RequestBody$Item$Post = PostBody;
export type ShapeOfRequestBody$Item$Post = ShapeOfPostBody;
export const makeRequestBody$Item$Post: oar.make.Maker<ShapeOfRequestBody$Item$Post, RequestBody$Item$Post> = oar.make.createMaker(function () { return makePostBody; });
export type Response$Item$Post = {
    readonly status: 201;
    readonly value: {
        readonly contentType: "application/json";
        readonly value: common.Item;
    };
} | {
    readonly status: 200 | 204;
    readonly value: {
        readonly contentType: "application/json";
        readonly value: Error;
    };
};
export type ShapeOfResponse$Item$Post = {
    readonly status: 201;
    readonly value: {
        readonly contentType: "application/json";
        readonly value: common.ShapeOfItem;
    };
} | {
    readonly status: 200 | 204;
    readonly value: {
        readonly contentType: "application/json";
        readonly value: ShapeOfError;
    };
};
export const makeResponse$Item$Post: oar.make.Maker<ShapeOfResponse$Item$Post, Response$Item$Post> = oar.make.createMaker(function () { return oar.make.makeOneOf(oar.make.makeObject({
    status: oar.make.makeEnum(201),
    value: oar.make.makeOneOf(oar.make.makeObject({
        contentType: oar.make.makeEnum("application/json"),
        value: common.makeItem
    }))
}), oar.make.makeObject({
    status: oar.make.makeEnum(200, 204),
    value: oar.make.makeOneOf(oar.make.makeObject({
        contentType: oar.make.makeEnum("application/json"),
        value: makeError
    }))
})); });
export type Query$Item$Id$Delete = void;
export type ShapeOfQuery$Item$Id$Delete = void;
export const makeQuery$Item$Id$Delete: oar.make.Maker<ShapeOfQuery$Item$Id$Delete, Query$Item$Id$Delete> = oar.make.createMaker(function () { return oar.make.makeVoid(); });
export type Headers$Item$Id$Delete = void;
export type ShapeOfHeaders$Item$Id$Delete = void;
export const makeHeaders$Item$Id$Delete: oar.make.Maker<ShapeOfHeaders$Item$Id$Delete, Headers$Item$Id$Delete> = oar.make.createMaker(function () { return oar.make.makeVoid(); });
export interface ShapeOfParameters$Item$Id$Delete {
    readonly id: common.ShapeOfItemId;
}
enum BrandOfParameters$Item$Id$Delete {
}
export class Parameters$Item$Id$Delete extends oar.valueClass.ValueClass<ShapeOfParameters$Item$Id$Delete, BrandOfParameters$Item$Id$Delete> implements ShapeOfParameters$Item$Id$Delete {
    readonly id!: common.ItemId;
    public constructor(value: ShapeOfParameters$Item$Id$Delete, opts?: oar.make.MakeOptions) { super(); Object.assign(this, buildParameters$Item$Id$Delete(value, opts).success()); }
    static make(value: ShapeOfParameters$Item$Id$Delete, opts?: oar.make.MakeOptions): oar.make.Make<Parameters$Item$Id$Delete> { return makeParameters$Item$Id$Delete(value, opts); }
}
export const buildParameters$Item$Id$Delete: oar.make.Maker<ShapeOfParameters$Item$Id$Delete, ShapeOfParameters$Item$Id$Delete> = oar.make.createMaker(function () { return oar.make.makeObject({
    id: common.makeItemId
}); });
export const makeParameters$Item$Id$Delete: oar.make.Maker<ShapeOfParameters$Item$Id$Delete, Parameters$Item$Id$Delete> = oar.make.createMakerWith(Parameters$Item$Id$Delete);
export type RequestBody$Item$Id$Delete = void;
export type ShapeOfRequestBody$Item$Id$Delete = void;
export const makeRequestBody$Item$Id$Delete: oar.make.Maker<ShapeOfRequestBody$Item$Id$Delete, RequestBody$Item$Id$Delete> = oar.make.createMaker(function () { return oar.make.makeVoid(); });
export type Response$Item$Id$Delete = {
    readonly status: 204;
    readonly value: NoContent;
};
export type ShapeOfResponse$Item$Id$Delete = {
    readonly status: 204;
    readonly value: ShapeOfNoContent;
};
export const makeResponse$Item$Id$Delete: oar.make.Maker<ShapeOfResponse$Item$Id$Delete, Response$Item$Id$Delete> = oar.make.createMaker(function () { return oar.make.makeOneOf(oar.make.makeObject({
    status: oar.make.makeEnum(204),
    value: makeNoContent
})); });
export type Query$Item$Id$Get = void;
export type ShapeOfQuery$Item$Id$Get = void;
export const makeQuery$Item$Id$Get: oar.make.Maker<ShapeOfQuery$Item$Id$Get, Query$Item$Id$Get> = oar.make.createMaker(function () { return oar.make.makeVoid(); });
export type Headers$Item$Id$Get = void;
export type ShapeOfHeaders$Item$Id$Get = void;
export const makeHeaders$Item$Id$Get: oar.make.Maker<ShapeOfHeaders$Item$Id$Get, Headers$Item$Id$Get> = oar.make.createMaker(function () { return oar.make.makeVoid(); });
export interface ShapeOfParameters$Item$Id$Get {
    readonly id: common.ShapeOfItemId;
}
enum BrandOfParameters$Item$Id$Get {
}
export class Parameters$Item$Id$Get extends oar.valueClass.ValueClass<ShapeOfParameters$Item$Id$Get, BrandOfParameters$Item$Id$Get> implements ShapeOfParameters$Item$Id$Get {
    readonly id!: common.ItemId;
    public constructor(value: ShapeOfParameters$Item$Id$Get, opts?: oar.make.MakeOptions) { super(); Object.assign(this, buildParameters$Item$Id$Get(value, opts).success()); }
    static make(value: ShapeOfParameters$Item$Id$Get, opts?: oar.make.MakeOptions): oar.make.Make<Parameters$Item$Id$Get> { return makeParameters$Item$Id$Get(value, opts); }
}
export const buildParameters$Item$Id$Get: oar.make.Maker<ShapeOfParameters$Item$Id$Get, ShapeOfParameters$Item$Id$Get> = oar.make.createMaker(function () { return oar.make.makeObject({
    id: common.makeItemId
}); });
export const makeParameters$Item$Id$Get: oar.make.Maker<ShapeOfParameters$Item$Id$Get, Parameters$Item$Id$Get> = oar.make.createMakerWith(Parameters$Item$Id$Get);
export type RequestBody$Item$Id$Get = void;
export type ShapeOfRequestBody$Item$Id$Get = void;
export const makeRequestBody$Item$Id$Get: oar.make.Maker<ShapeOfRequestBody$Item$Id$Get, RequestBody$Item$Id$Get> = oar.make.createMaker(function () { return oar.make.makeVoid(); });
export type Response$Item$Id$Get = {
    readonly status: 200;
    readonly value: {
        readonly contentType: "application/json";
        readonly value: common.Item;
    };
} | {
    readonly status: 201 | 204;
    readonly value: {
        readonly contentType: "application/json";
        readonly value: Error;
    };
};
export type ShapeOfResponse$Item$Id$Get = {
    readonly status: 200;
    readonly value: {
        readonly contentType: "application/json";
        readonly value: common.ShapeOfItem;
    };
} | {
    readonly status: 201 | 204;
    readonly value: {
        readonly contentType: "application/json";
        readonly value: ShapeOfError;
    };
};
export const makeResponse$Item$Id$Get: oar.make.Maker<ShapeOfResponse$Item$Id$Get, Response$Item$Id$Get> = oar.make.createMaker(function () { return oar.make.makeOneOf(oar.make.makeObject({
    status: oar.make.makeEnum(200),
    value: oar.make.makeOneOf(oar.make.makeObject({
        contentType: oar.make.makeEnum("application/json"),
        value: common.makeItem
    }))
}), oar.make.makeObject({
    status: oar.make.makeEnum(201, 204),
    value: oar.make.makeOneOf(oar.make.makeObject({
        contentType: oar.make.makeEnum("application/json"),
        value: makeError
    }))
})); });
