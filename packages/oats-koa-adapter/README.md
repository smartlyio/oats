# Oats Koa Adapter

Oats Koa Adapter is a library that binds server endpoints written with [Oats](https://github.com/smartlyio/oats) to [Koa's](https://koajs.com/) `Router` object.

## What is Oats?

[Oats](https://github.com/smartlyio/oats) is a library that parses OpenAPI specifications and generates client and server code in TypeScript.

[Koa](https://koajs.com/) is a web framework for node.js applications.

## Installation

Use `npm` or `yarn` to install `oats-koa-adapter`.

```bash
npm install oats-koa-adapter
```

## Usage

Oats Koa Adapter exports a single `bind` function. This function is generally used when setting up the router for your application.

### Basic Example

```ts
// router.ts

import * as koaAdapter from '@smartlyio/koa-oats-adapter';
import * as Router from 'koa-router'
import * as oaserver from '<Your Generated Server>';
import spec from '<Your Route Definitions>';

export const router = () => {
  const requestContextCreator = (ctx: any): any => ctx;

  const oatsRouter = koaAdapter.bind(oaserver.router, spec, requestContextCreator);

  return new Router().use(oatsRouter.routes())
};


```

### Defining Types for Request Context

There are two ways to add types to your context, each with their own benefits and drawbacks.

#### Using `any`

This approach uses the default behavior in the library, but uses TypeScript's `any` to force router to work in the bind function.

```ts
// router.ts

import * as koaAdapter from '@smartlyio/koa-oats-adapter';
import * as Router from 'koa-router'
import * as oaserver from '<Your Generated Server>';
import spec from '<Your Route Definitions>';

interface RequestContext {
  id: string
}

export const router = () => {
  const requestContextCreator = (ctx: any): RequestContext => ctx;

  const oatsRouter = koaAdapter.bind<
    oaserver.EndpointsWithContext<RequestContext>,
    RequestContext
  >(oaserver.router as any, spec, requestContextCreator);

  return new Router().use(oatsRouter.routes());
}
```

#### Configuring Generated Code

This approach injects itself into the default behavior of the generated code, using the `oats-runtime` directly and avoiding the use of `any`.

```ts
// app.ts
import * as Koa from 'koa'
import { Context, State } from './router'

const app = new Koa<State, Context<State>>()

// continue Koa setup...
```

```ts
// router.ts

import * as koaAdapter from '@smartlyio/koa-oats-adapter';
import * as oatsRuntime from "@smartlyio/oats-runtime";
import * as oaserver from '<Your Generated Server>';
import spec from '<Your Route Definitions>';

export interface State {
  id: string
}

export interface Context<S> {
  state: S
}

type Spec = oaserver.EndpointsWithContext<Context<State>>;

export const router = () => {
  const { createHandlerFactory } = oatsRuntime.server;
  const handler = createHandlerFactory<Spec>(oaserver.endpointHandlers);

  const copyKoaCtxToOatsCtx = (ctx: any): Context<State> => ({ ...ctx });
  const oatsRouter = koaAdapter.bind<Spec, Context<State>>(handler, spec, copyKoaCtxToOatsCtx);

  return new Router().use(oatsRouter.routes())
}
```
