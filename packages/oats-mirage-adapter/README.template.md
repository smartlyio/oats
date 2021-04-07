# Oats Mirage Adapter

Oats Mirage Adapter is a library that [Oats](https://github.com/smartlyio/oats) to [Mirage.js](https://github.com/miragejs/miragejs) fake Servers.

## What is Oats?

[Oats](https://github.com/smartlyio/oats) is a library that parses OpenAPI specifications and generates client and server code in TypeScript.

## Installation

Use `npm` or `yarn` to install `oats-mirage-adapter`.

```bash
npm install oats-mirage-adapter
```

## Usage

Oats Mirage Adapter exports a single `bind` function that creates a Mirage fake server from the passed in endpoint definitions.


```ts
>>test-app/src/fake-server.ts
```

For a working example see [test-app](https://github.com/smartlyio/oats-mirage-adapter/tree/master/test-app) which contains a standard create-react-app using the generated mirage mock.
