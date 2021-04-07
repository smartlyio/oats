/* tslint:disable variable-name only-arrow-functions*/
import * as oar from "@smartlyio/oats-runtime";
type InternalUnsafeConstructorOption = {
    unSafeSet: true;
};
export const typeItem: oar.reflection.NamedTypeDefinition<Item, ShapeOfItem> = {} as any;
export type ShapeOfItem = oar.ShapeOf<Item>;
enum BrandOfItem {
}
export class Item extends oar.valueClass.ValueClass<never, BrandOfItem> {
    readonly message!: string;
    // @ts-ignore tsc does not like unused privates
    private readonly __oats_value_class_brand_tag!: string;
    public constructor(value: ShapeOfItem, opts?: oar.make.MakeOptions | InternalUnsafeConstructorOption) { super(); Object.assign(this, opts && "unSafeSet" in opts ? value : buildItem(value, opts).success()); }
    public static reflection: oar.reflection.NamedTypeDefinition<Item> = typeItem;
    static make(value: ShapeOfItem, opts?: oar.make.MakeOptions): oar.make.Make<Item> { const make = buildItem(value, opts); return make.isError() ? oar.make.Make.error(make.errors) : oar.make.Make.ok(new Item(make.success(), { unSafeSet: true })); }
}
export const buildItem: oar.make.Maker<ShapeOfItem, ShapeOfItem> = oar.make.createMaker(function () { return oar.make.makeObject({
    message: oar.make.makeString(undefined, undefined)
}); });
export const makeItem: oar.make.Maker<ShapeOfItem, Item> = Item.make;
Object.assign(typeItem, {
    name: "Item",
    definition: {
        type: "object",
        additionalProperties: false,
        properties: {
            "message": {
                required: true,
                value: {
                    type: "string"
                }
            }
        }
    },
    maker: makeItem,
    isA: (value: any) => value instanceof Item
})
export const typePostBody: oar.reflection.NamedTypeDefinition<PostBody, ShapeOfPostBody> = {} as any;
export type PostBody = {
    readonly contentType: "application/json";
    readonly value: Item;
};
export type ShapeOfPostBody = oar.ShapeOf<PostBody>;
export const makePostBody: oar.make.Maker<ShapeOfPostBody, PostBody> = oar.make.createMaker(function () { return oar.make.makeOneOf(oar.make.makeObject({
    contentType: oar.make.makeEnum("application/json"),
    value: makeItem
})); });
Object.assign(typePostBody, {
    name: "PostBody",
    definition: {
        type: "union",
        options: [
            {
                type: "object",
                additionalProperties: false,
                properties: {
                    "contentType": {
                        required: true,
                        value: {
                            type: "string",
                            enum: ["application/json"]
                        }
                    },
                    "value": {
                        required: true,
                        value: {
                            type: "named",
                            reference: typeItem
                        }
                    }
                }
            }
        ]
    },
    maker: makePostBody,
    isA: null
})
export const typeQuery$Example$Id$Get: oar.reflection.NamedTypeDefinition<Query$Example$Id$Get, ShapeOfQuery$Example$Id$Get> = {} as any;
export type ShapeOfQuery$Example$Id$Get = oar.ShapeOf<Query$Example$Id$Get>;
enum BrandOfQuery$Example$Id$Get {
}
export class Query$Example$Id$Get extends oar.valueClass.ValueClass<never, BrandOfQuery$Example$Id$Get> {
    readonly foo?: string;
    // @ts-ignore tsc does not like unused privates
    private readonly __oats_value_class_brand_tag!: string;
    public constructor(value: ShapeOfQuery$Example$Id$Get, opts?: oar.make.MakeOptions | InternalUnsafeConstructorOption) { super(); Object.assign(this, opts && "unSafeSet" in opts ? value : buildQuery$Example$Id$Get(value, opts).success()); }
    public static reflection: oar.reflection.NamedTypeDefinition<Query$Example$Id$Get> = typeQuery$Example$Id$Get;
    static make(value: ShapeOfQuery$Example$Id$Get, opts?: oar.make.MakeOptions): oar.make.Make<Query$Example$Id$Get> { const make = buildQuery$Example$Id$Get(value, opts); return make.isError() ? oar.make.Make.error(make.errors) : oar.make.Make.ok(new Query$Example$Id$Get(make.success(), { unSafeSet: true })); }
}
export const buildQuery$Example$Id$Get: oar.make.Maker<ShapeOfQuery$Example$Id$Get, ShapeOfQuery$Example$Id$Get> = oar.make.createMaker(function () { return oar.make.makeObject({
    foo: oar.make.makeOptional(oar.make.makeString(undefined, undefined))
}); });
export const makeQuery$Example$Id$Get: oar.make.Maker<ShapeOfQuery$Example$Id$Get, Query$Example$Id$Get> = Query$Example$Id$Get.make;
Object.assign(typeQuery$Example$Id$Get, {
    name: "Query$Example$Id$Get",
    definition: {
        type: "object",
        additionalProperties: false,
        properties: {
            "foo": {
                required: false,
                value: {
                    type: "string"
                }
            }
        }
    },
    maker: makeQuery$Example$Id$Get,
    isA: (value: any) => value instanceof Query$Example$Id$Get
})
export const typeHeaders$Example$Id$Get: oar.reflection.NamedTypeDefinition<Headers$Example$Id$Get, ShapeOfHeaders$Example$Id$Get> = {} as any;
export type Headers$Example$Id$Get = void;
export type ShapeOfHeaders$Example$Id$Get = oar.ShapeOf<Headers$Example$Id$Get>;
export const makeHeaders$Example$Id$Get: oar.make.Maker<ShapeOfHeaders$Example$Id$Get, Headers$Example$Id$Get> = oar.make.createMaker(function () { return oar.make.makeVoid(); });
Object.assign(typeHeaders$Example$Id$Get, {
    name: "Headers$Example$Id$Get",
    definition: {
        type: "void"
    },
    maker: makeHeaders$Example$Id$Get,
    isA: null
})
export const typeParameters$Example$Id$Get: oar.reflection.NamedTypeDefinition<Parameters$Example$Id$Get, ShapeOfParameters$Example$Id$Get> = {} as any;
export type ShapeOfParameters$Example$Id$Get = oar.ShapeOf<Parameters$Example$Id$Get>;
enum BrandOfParameters$Example$Id$Get {
}
export class Parameters$Example$Id$Get extends oar.valueClass.ValueClass<never, BrandOfParameters$Example$Id$Get> {
    readonly id!: string;
    // @ts-ignore tsc does not like unused privates
    private readonly __oats_value_class_brand_tag!: string;
    public constructor(value: ShapeOfParameters$Example$Id$Get, opts?: oar.make.MakeOptions | InternalUnsafeConstructorOption) { super(); Object.assign(this, opts && "unSafeSet" in opts ? value : buildParameters$Example$Id$Get(value, opts).success()); }
    public static reflection: oar.reflection.NamedTypeDefinition<Parameters$Example$Id$Get> = typeParameters$Example$Id$Get;
    static make(value: ShapeOfParameters$Example$Id$Get, opts?: oar.make.MakeOptions): oar.make.Make<Parameters$Example$Id$Get> { const make = buildParameters$Example$Id$Get(value, opts); return make.isError() ? oar.make.Make.error(make.errors) : oar.make.Make.ok(new Parameters$Example$Id$Get(make.success(), { unSafeSet: true })); }
}
export const buildParameters$Example$Id$Get: oar.make.Maker<ShapeOfParameters$Example$Id$Get, ShapeOfParameters$Example$Id$Get> = oar.make.createMaker(function () { return oar.make.makeObject({
    id: oar.make.makeString(undefined, undefined)
}); });
export const makeParameters$Example$Id$Get: oar.make.Maker<ShapeOfParameters$Example$Id$Get, Parameters$Example$Id$Get> = Parameters$Example$Id$Get.make;
Object.assign(typeParameters$Example$Id$Get, {
    name: "Parameters$Example$Id$Get",
    definition: {
        type: "object",
        additionalProperties: false,
        properties: {
            "id": {
                required: true,
                value: {
                    type: "string"
                }
            }
        }
    },
    maker: makeParameters$Example$Id$Get,
    isA: (value: any) => value instanceof Parameters$Example$Id$Get
})
export const typeRequestBody$Example$Id$Get: oar.reflection.NamedTypeDefinition<RequestBody$Example$Id$Get, ShapeOfRequestBody$Example$Id$Get> = {} as any;
export type RequestBody$Example$Id$Get = void;
export type ShapeOfRequestBody$Example$Id$Get = oar.ShapeOf<RequestBody$Example$Id$Get>;
export const makeRequestBody$Example$Id$Get: oar.make.Maker<ShapeOfRequestBody$Example$Id$Get, RequestBody$Example$Id$Get> = oar.make.createMaker(function () { return oar.make.makeVoid(); });
Object.assign(typeRequestBody$Example$Id$Get, {
    name: "RequestBody$Example$Id$Get",
    definition: {
        type: "void"
    },
    maker: makeRequestBody$Example$Id$Get,
    isA: null
})
export const typeResponse$Example$Id$Get: oar.reflection.NamedTypeDefinition<Response$Example$Id$Get, ShapeOfResponse$Example$Id$Get> = {} as any;
export type Response$Example$Id$Get = {
    readonly status: 200;
    readonly value: {
        readonly contentType: "application/json";
        readonly value: Item;
    };
    readonly headers: {
        readonly location?: string;
        readonly [key: string]: string | undefined;
    };
};
export type ShapeOfResponse$Example$Id$Get = oar.ShapeOf<Response$Example$Id$Get>;
export const makeResponse$Example$Id$Get: oar.make.Maker<ShapeOfResponse$Example$Id$Get, Response$Example$Id$Get> = oar.make.createMaker(function () { return oar.make.makeOneOf(oar.make.makeObject({
    status: oar.make.makeEnum(200),
    value: oar.make.makeOneOf(oar.make.makeObject({
        contentType: oar.make.makeEnum("application/json"),
        value: makeItem
    })),
    headers: oar.make.makeObject({
        location: oar.make.makeOptional(oar.make.makeString(undefined, undefined))
    }, oar.make.makeString(undefined, undefined))
})); });
Object.assign(typeResponse$Example$Id$Get, {
    name: "Response$Example$Id$Get",
    definition: {
        type: "union",
        options: [
            {
                type: "object",
                additionalProperties: false,
                properties: {
                    "status": {
                        required: true,
                        value: {
                            type: "integer",
                            enum: [200]
                        }
                    },
                    "value": {
                        required: true,
                        value: {
                            type: "union",
                            options: [
                                {
                                    type: "object",
                                    additionalProperties: false,
                                    properties: {
                                        "contentType": {
                                            required: true,
                                            value: {
                                                type: "string",
                                                enum: ["application/json"]
                                            }
                                        },
                                        "value": {
                                            required: true,
                                            value: {
                                                type: "named",
                                                reference: typeItem
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    "headers": {
                        required: true,
                        value: {
                            type: "object",
                            additionalProperties: {
                                type: "string"
                            },
                            properties: {
                                "location": {
                                    required: false,
                                    value: {
                                        type: "string"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ]
    },
    maker: makeResponse$Example$Id$Get,
    isA: null
})
export const typeQuery$Example$Id$Post: oar.reflection.NamedTypeDefinition<Query$Example$Id$Post, ShapeOfQuery$Example$Id$Post> = {} as any;
export type ShapeOfQuery$Example$Id$Post = oar.ShapeOf<Query$Example$Id$Post>;
enum BrandOfQuery$Example$Id$Post {
}
export class Query$Example$Id$Post extends oar.valueClass.ValueClass<never, BrandOfQuery$Example$Id$Post> {
    readonly foo?: string;
    // @ts-ignore tsc does not like unused privates
    private readonly __oats_value_class_brand_tag!: string;
    public constructor(value: ShapeOfQuery$Example$Id$Post, opts?: oar.make.MakeOptions | InternalUnsafeConstructorOption) { super(); Object.assign(this, opts && "unSafeSet" in opts ? value : buildQuery$Example$Id$Post(value, opts).success()); }
    public static reflection: oar.reflection.NamedTypeDefinition<Query$Example$Id$Post> = typeQuery$Example$Id$Post;
    static make(value: ShapeOfQuery$Example$Id$Post, opts?: oar.make.MakeOptions): oar.make.Make<Query$Example$Id$Post> { const make = buildQuery$Example$Id$Post(value, opts); return make.isError() ? oar.make.Make.error(make.errors) : oar.make.Make.ok(new Query$Example$Id$Post(make.success(), { unSafeSet: true })); }
}
export const buildQuery$Example$Id$Post: oar.make.Maker<ShapeOfQuery$Example$Id$Post, ShapeOfQuery$Example$Id$Post> = oar.make.createMaker(function () { return oar.make.makeObject({
    foo: oar.make.makeOptional(oar.make.makeString(undefined, undefined))
}); });
export const makeQuery$Example$Id$Post: oar.make.Maker<ShapeOfQuery$Example$Id$Post, Query$Example$Id$Post> = Query$Example$Id$Post.make;
Object.assign(typeQuery$Example$Id$Post, {
    name: "Query$Example$Id$Post",
    definition: {
        type: "object",
        additionalProperties: false,
        properties: {
            "foo": {
                required: false,
                value: {
                    type: "string"
                }
            }
        }
    },
    maker: makeQuery$Example$Id$Post,
    isA: (value: any) => value instanceof Query$Example$Id$Post
})
export const typeHeaders$Example$Id$Post: oar.reflection.NamedTypeDefinition<Headers$Example$Id$Post, ShapeOfHeaders$Example$Id$Post> = {} as any;
export type Headers$Example$Id$Post = void;
export type ShapeOfHeaders$Example$Id$Post = oar.ShapeOf<Headers$Example$Id$Post>;
export const makeHeaders$Example$Id$Post: oar.make.Maker<ShapeOfHeaders$Example$Id$Post, Headers$Example$Id$Post> = oar.make.createMaker(function () { return oar.make.makeVoid(); });
Object.assign(typeHeaders$Example$Id$Post, {
    name: "Headers$Example$Id$Post",
    definition: {
        type: "void"
    },
    maker: makeHeaders$Example$Id$Post,
    isA: null
})
export const typeParameters$Example$Id$Post: oar.reflection.NamedTypeDefinition<Parameters$Example$Id$Post, ShapeOfParameters$Example$Id$Post> = {} as any;
export type ShapeOfParameters$Example$Id$Post = oar.ShapeOf<Parameters$Example$Id$Post>;
enum BrandOfParameters$Example$Id$Post {
}
export class Parameters$Example$Id$Post extends oar.valueClass.ValueClass<never, BrandOfParameters$Example$Id$Post> {
    readonly id!: string;
    // @ts-ignore tsc does not like unused privates
    private readonly __oats_value_class_brand_tag!: string;
    public constructor(value: ShapeOfParameters$Example$Id$Post, opts?: oar.make.MakeOptions | InternalUnsafeConstructorOption) { super(); Object.assign(this, opts && "unSafeSet" in opts ? value : buildParameters$Example$Id$Post(value, opts).success()); }
    public static reflection: oar.reflection.NamedTypeDefinition<Parameters$Example$Id$Post> = typeParameters$Example$Id$Post;
    static make(value: ShapeOfParameters$Example$Id$Post, opts?: oar.make.MakeOptions): oar.make.Make<Parameters$Example$Id$Post> { const make = buildParameters$Example$Id$Post(value, opts); return make.isError() ? oar.make.Make.error(make.errors) : oar.make.Make.ok(new Parameters$Example$Id$Post(make.success(), { unSafeSet: true })); }
}
export const buildParameters$Example$Id$Post: oar.make.Maker<ShapeOfParameters$Example$Id$Post, ShapeOfParameters$Example$Id$Post> = oar.make.createMaker(function () { return oar.make.makeObject({
    id: oar.make.makeString(undefined, undefined)
}); });
export const makeParameters$Example$Id$Post: oar.make.Maker<ShapeOfParameters$Example$Id$Post, Parameters$Example$Id$Post> = Parameters$Example$Id$Post.make;
Object.assign(typeParameters$Example$Id$Post, {
    name: "Parameters$Example$Id$Post",
    definition: {
        type: "object",
        additionalProperties: false,
        properties: {
            "id": {
                required: true,
                value: {
                    type: "string"
                }
            }
        }
    },
    maker: makeParameters$Example$Id$Post,
    isA: (value: any) => value instanceof Parameters$Example$Id$Post
})
export const typeRequestBody$Example$Id$Post: oar.reflection.NamedTypeDefinition<RequestBody$Example$Id$Post, ShapeOfRequestBody$Example$Id$Post> = {} as any;
export type RequestBody$Example$Id$Post = PostBody;
export type ShapeOfRequestBody$Example$Id$Post = oar.ShapeOf<RequestBody$Example$Id$Post>;
export const makeRequestBody$Example$Id$Post: oar.make.Maker<ShapeOfRequestBody$Example$Id$Post, RequestBody$Example$Id$Post> = oar.make.createMaker(function () { return makePostBody; });
Object.assign(typeRequestBody$Example$Id$Post, {
    name: "RequestBody$Example$Id$Post",
    definition: {
        type: "named",
        reference: typePostBody
    },
    maker: makeRequestBody$Example$Id$Post,
    isA: null
})
export const typeResponse$Example$Id$Post: oar.reflection.NamedTypeDefinition<Response$Example$Id$Post, ShapeOfResponse$Example$Id$Post> = {} as any;
export type Response$Example$Id$Post = {
    readonly status: 200;
    readonly value: {
        readonly contentType: "application/json";
        readonly value: Item;
    };
    readonly headers: {
        readonly location?: string;
        readonly [key: string]: string | undefined;
    };
};
export type ShapeOfResponse$Example$Id$Post = oar.ShapeOf<Response$Example$Id$Post>;
export const makeResponse$Example$Id$Post: oar.make.Maker<ShapeOfResponse$Example$Id$Post, Response$Example$Id$Post> = oar.make.createMaker(function () { return oar.make.makeOneOf(oar.make.makeObject({
    status: oar.make.makeEnum(200),
    value: oar.make.makeOneOf(oar.make.makeObject({
        contentType: oar.make.makeEnum("application/json"),
        value: makeItem
    })),
    headers: oar.make.makeObject({
        location: oar.make.makeOptional(oar.make.makeString(undefined, undefined))
    }, oar.make.makeString(undefined, undefined))
})); });
Object.assign(typeResponse$Example$Id$Post, {
    name: "Response$Example$Id$Post",
    definition: {
        type: "union",
        options: [
            {
                type: "object",
                additionalProperties: false,
                properties: {
                    "status": {
                        required: true,
                        value: {
                            type: "integer",
                            enum: [200]
                        }
                    },
                    "value": {
                        required: true,
                        value: {
                            type: "union",
                            options: [
                                {
                                    type: "object",
                                    additionalProperties: false,
                                    properties: {
                                        "contentType": {
                                            required: true,
                                            value: {
                                                type: "string",
                                                enum: ["application/json"]
                                            }
                                        },
                                        "value": {
                                            required: true,
                                            value: {
                                                type: "named",
                                                reference: typeItem
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    "headers": {
                        required: true,
                        value: {
                            type: "object",
                            additionalProperties: {
                                type: "string"
                            },
                            properties: {
                                "location": {
                                    required: false,
                                    value: {
                                        type: "string"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ]
    },
    maker: makeResponse$Example$Id$Post,
    isA: null
})
