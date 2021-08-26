# Oats

Oats is a generator for TypeScript clients and servers using OpenAPI 3 specs.

For some more context on why Oats came to be, and a more descriptive way of how to use it, check out our blogpost:
https://medium.com/smartly-io/oats-how-we-learned-to-stop-worrying-and-love-types-aa0041aaa9cc

This package provides the tooling for generating the type definitions. A separate package provides 
the [runtime](https://github.com/smartlyio/oats-runtime) that contains the code and base types 
needed for actually using the generated definitions.

## Generating type definitions

Oats exposes `driver.generate` for configuring and running the generator. 

As an example here we are generating a client and server definitions from an api specification 
in `example.yaml` that uses additional component schemas defined in `common.yaml`. 

```ts
>>examples/driver.ts
```

The generated typescript types contain a type for all named components defined in the Openapi 
spec `components/schemas`.  So for a component `named_component: ...`
 - For top level `type: object` definitions oats generates a proper 
javascript class `NamedComponent`
 - For other types oats generates a typescript `type NamedComponent`. 
 - For scalar types oats adds typescript branding to differentiate between various kinds of 
 named scalar types
 
 For `type: object` schemas that are `nullable: true` the type is split to a `type NamedComponent = null | NonNullableNamedComponent` 
 where `NonNullableNamedComponent` is the actual class as class instances really cannot be `null`.
 
 See [runtime](https://github.com/smartlyio/oats/tree/master/packages/oats-runtime) for details on working with the types.
 
 The rest of the generated type definitions consist of the apis for clients and servers for actually 
 implementing or interacting with the service.

## Type resolution

By default the `driver` will only resolve `$ref`  references to absolute paths inside the processed file. This behaviour can be 
added to by using the `resolve` option to `driver` which defines a function of type `Resolve` to be used when a `$ref` is 
encountered.

```
export type Resolve = (ref: string, options: Options) =>
  | { importAs: string; importFrom: string, name: string, generate?: () => Promise<void> }
  | { name: string }
  | undefined;

```

There are two builtin helpers for resolution which are used in the above code example

 - `generateFile` which follows the references and generates the required files and import declarations
 - `localFile` which only resolves `$ref` inside the same file to the name produced from `$ref` value. 

## Server usage

The generated server definition can be adapted to http servers backends for node. 
See for example the [koa adapter](https://github.com/smartlyio/oats/tree/master/packages/oats-koa-adapter). 

For each Openapi3 definition `get: /path/subpath` the generated server requires the user to provide a 
value of type
```
{ 'path/subpath': { get: ctx => Promise<response> }}
```

for handling the requests to the server.

The generated server definition enforces *strict* data validation for both input and output for all 
defined paths. 

```ts
>>examples/server.ts
```

## Client usage

Oats generates also client side definitions that can be adapted to http client backends for node.
See for example the [axios adapter](https://github.com/smartlyio/oats/tree/master/packages/oats-axios-adapter). The 
generated client provides a fluent interface so that for each Openapi3 definition 
`get: /path/subpath/{pathParameter}` the 
generated  api client can be called with `api.path.subpath(pathParameter).get()`. The generated 
client will enforce *strict* data validation for both input and output of the calls.

```ts
>>examples/client.ts
```

## Testing

We support also property based testing and test data generation with 
[fast-check](https://github.com/dubzzz/fast-check) through 
[oats-fast-check](https://github.com/smartlyio/oats/tree/master/packages/oats-fast-check)
