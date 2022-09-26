# 6.0.0
Fix compatibility with TypeScript 4.8 and above.
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
