# 7.4.4


## Bug fig: allow expand=true with multiple query parameters when the query parameter schemas are not 

 * references
 * objects
 * allOf, anyOf, oneOf

Even with this the current implementation of the query parameter parsing does correctly implement OpenAPI3 query
parameter specification as the whole expand=true is misunderstood in the Oats code. It will hopefully do what we want in
practise though.

# 7.4.3

Bug fix for network mapping when a value was made with different makers. 

```
   const value = Amake(input).success();
   const value2 = Bmake(value).success();
```

# 7.4.0

value2 had both A and B types and network mapping tried to use mapping also from A type when it should have only used mappings from type B if any.
Now value2 does not have a linkage anymore to type A and will not be considered when network mapping. 

Note: because value2 does not have type A anymore any `getType` or `getTypeSet` reflection calls will return different
results to what was previously returned.

There may be a performance downside to this as we might end up doing extra work as we lose the type information. 
Even without doing double `.make` by hand allOf parsing may result in more work being done as we clear the extra type information before parsing.

# 6.2.0

Bug fix that changes aliasing of objects returned by Oats. Now re-making an object with the same maker will return the
same object (by ===).  Eg `const a = typeValue.maker({a: 1}).success(); assert(a === typeValue.maker(a).success())` will hold.

This will improve performance when re-parsing objects but changes the caller behaviour when the
identity of the object is important.

# 6.1.0

Update the implementation of `makeObject` so that if `additionalProperties` is an object or `false` then it will drop the properties with undefined value.

# 6.0.0

Update to use typescript ^4.8. Some deprecated apis got broken in ts 4.8 and the new apis are not backwards compatible. 
Remove deprecated driver options `externalOpenApiSpecs` and `externalOpenApiImports`. Use `resolve` instead.

# 5.1.4

Fixed serializing to network format not converting property names to network format in `allOf` in all cases.

# 5.0.0

Allow mapping properties from network format specified in the openapi spec to something more expected in typescript. Eg
from snake_case to camelCase. The mapping is done using `propertyNameMapper` function passed to the driver configuration
when generating code.

NOTE: the mapping is not done for `additionalProperties` property names as those often contain maps and mapping map keys
seemed unwise and hard to do.

NOTE: unknown types such as property values for `additionalProperties: true` properties are not mapped as we do not know
the schemas for those values.

## Silently breaking change 

Due to the mapping we cannot anymore lowercase request headers on the client side. This has been prevented before by the
type system but if somebody has subverted the type system to allow upper cased headers you will have a bad time as 
the uppercased headers will be dropped now. This only affects the client side usage of oats. Please check that you have well typed
request headers on client side.

# 4.3.2

## Bug Fixes

### `encodeURI` is replaced with `encodeurl` for redirect url encoding.

`encodeURI` does double encoding of already encoded query parameters. `runtime.redirect()` will encode url with `encodeurl` now. See https://github.com/pillarjs/encodeurl.

# 4.3.0

## Bug Fixes

### @smartlyio/oats-koa-adapter - set content-type specified in openapi spec

Prior to that, the content type was determined automatically by Koa.

# 4.1.0

Provide option `emitUndefinedForIndexTypes` (default true for backwards compatibility) which can be set to 
false to avoid generating union types with `undefined` for `additionalProperties`.

Typescript can be [configured](https://www.typescriptlang.org/tsconfig#noUncheckedIndexedAccess) to consider
index signature accesses to have implicit undefined type so we can let the caller decide on the level of safety they want.

# 4.0.0

Fix cyclical imports and lose the need for `Object.assign` in the generated types.

## Breaking changes:
Type of `reference` in named reflection nodes has changed to `() => ...`
Type of `reflection` in `ValueClass` classes has changed to `() => ...`

# 3.5.0

Allow passing middlewares to oats-koa-adapter in `bind`. The middlewares are applied to all specified endpoints.

# 3.4.0

oats-koa-adapter does not anymore set status code 204 when no content is set in response body.
This might break existing usages relying on the broken previous behavior.

# 3.3.0

## Introduce `nameMapper` in code generator options

The `nameMapper` callback allows customizing the exported value, shape and reflection type names. Eg to
omit `ShapeOf` in `ShapeOfType` for nicer usage when preferring to use shapes instead of `ValueClass`

# 3.2.0

## Features

### Inroduce `parseNumericStrings`, `parseBooleanStrings`, `allowConvertForArrayType` validation options.

They enable us to use `number`, `interger`, `boolean` and `array` schema types for query and path parameters.
In the new generated `createRouter()` api they are enabled by default for query parameters.
For path parameters `parseNumericStrings` only is enabled by default.

### Deprecate generated `router` api in favor of `createRouter()`.

`createRouter()` supports parsing query and path parameters by default.

### Deprecate `axiosAdapter.bind` in favor of `axiosAdapter.create()`.

`axiosAdapter.create()` fixes the issue with axios suffixing array query parameters with `[]` (see https://github.com/axios/axios/issues/2840). This used not to work well with oats since it expects query parameter names to be the same on client and server.

## Bug Fixes

### `integer` schema type asserts a number is an integer.

This might break an implementation where `integer` schema type was by mistake used instead of `number` type. Validation in this case will not pass anymore.

# 3.0.0

## Deprecate non standard discriminator support.

oats-runtime still has the methods for backwards compatibility with already generated code but those are deprecated

## Faster oneOf matching

Oats now uses runtime type information for picking a better order of oneOf matching. If all the options for oneOf share a required 
enum property with distinct values this property is used to select the schema to try when runtime checking values.

Empirically this gets you close to performance of hand written discriminators without the bother of having to actually write those.

## Use reflection types for runtime checking

Drop generation of make structures in the generated code and instead use the runtime type information to construct the
runtime value checkers when needed. This might help in the size and complexity of the generated code. It at least helps in keeping the 
code generator workable.
