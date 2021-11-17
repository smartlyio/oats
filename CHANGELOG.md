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
