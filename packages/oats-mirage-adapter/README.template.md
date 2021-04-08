# Oats Mirage Adapter

Typesafe Typescript OpenaApi3 support for [Mirage.js](https://github.com/miragejs/miragejs) mock http servers
using [Oats](https://github.com/smartlyio/oats).

## What is Oats?

[Oats](https://github.com/smartlyio/oats) is a library that parses OpenAPI specifications and 
generates client and server definitions in TypeScript.

## Installation

Use `npm` or `yarn` to install `oats-mirage-adapter`.

```bash
npm install oats-mirage-adapter
```

## Usage

Oats Mirage Adapter exports a single `bind` function that can be used to 
bind the routes defined in an openapi spec to the mirage routes.


```ts
>>test-app/src/fake-server.ts
```

For a working example see [test-app](https://github.com/smartlyio/oats-mirage-adapter/tree/master/test-app) which contains a standard create-react-app using the generated mirage mock.
