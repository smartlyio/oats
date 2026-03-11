# Oats

## Summary on how to release new versions
1. Open a PR and add a label (`patch`/`minor`/`major`/`no-release`)
2. Wait for CI checks to pass (build, tests, label validation, npm token check)
3. Get your PR approved and merge it
4. A **version bump PR** is automatically created with updated package versions
5. Review and merge the version bump PR — all packages are published to npm

> **Note:** The npm token expires every 90 days. If the token check fails, follow the [NPM token rotation](#npm-token-rotation) instructions to generate a new one.

## About Oats

Oats is a generator for TypeScript clients and servers using OpenAPI 3 specs.

For some more context on why Oats came to be, and a more descriptive way of how to use it, check out our blogpost:
https://medium.com/smartly-io/oats-how-we-learned-to-stop-worrying-and-love-types-aa0041aaa9cc

This package provides the tooling for generating the type definitions. A separate package provides
the [runtime](https://github.com/smartlyio/oats/tree/master/packages/oats-runtime) that contains the code and base types
needed for actually using the generated definitions.

see [packages](https://github.com/smartlyio/oats/tree/master/packages) for tooling and adapters for koa, axios etc.

## Generating type definitions

Oats exposes `driver.generate` for configuring and running the generator.

As an example here we are generating a client and server definitions from an api specification
in `example.yaml` that uses additional component schemas defined in `common.yaml`.

```ts
// yarn ts-node -r tsconfig-paths/register examples/driver.ts
import { driver } from '@smartlyio/oats';

// generate server from the shared openapi spec
// This example uses a specification file that contains compliant but unsupported nodes,
// such as 'securitySchemes' and 'security'
driver.generate({
  generatedValueClassFile: './tmp/server/types.generated.ts',
  generatedServerFile: './tmp/server/generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/example-with-security-nodes.yaml',
  resolve: driver.compose(driver.generateFile(), driver.localResolve),
  unsupportedFeatures: {
    security: driver.UnsupportedFeatureBehaviour.ignore
  }
});

// generate client from the shared openapi spec
driver.generate({
  generatedValueClassFile: './tmp/client/types.generated.ts',
  generatedClientFile: './tmp/client/generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/example.yaml',
  resolve: driver.compose(
    driver.generateFile({ preservePathStructure: true }),
    driver.localResolve
  ),
  // Omit error responses  from the client response types
  emitStatusCode: (code: number) => [200, 201, 204].indexOf(code) >= 0
});

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
// yarn ts-node -r tsconfig-paths/register examples/server.ts
import * as api from '../tmp/server/generated';
import * as common from '../tmp/server/common.types.generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as koaAdapter from '@smartlyio/oats-koa-adapter';
import * as Koa from 'koa';
import { koaBody } from 'koa-body';

// setup a db :)
const values: { [key: string]: common.Item } = {};

interface RequestContext {
  messageIndex: number;
}

// 'api.EndpointsWithContext' is the generated type of the server
const spec: api.EndpointsWithContext<RequestContext> = {
  '/item': {
    post: async ctx => {
      if (ctx.headers.authorization !== 'Bearer ^-^') {
        return runtime.json(403, {
          message: 'Unauthorized',
          messageIndex: ctx.requestContext.messageIndex
        });
      }
      values[ctx.body.value.id] = common.Item.make({
        id: ctx.body.value.id,
        name: ctx.body.value.name
      }).success();
      return runtime.json(201, values[ctx.body.value.id]);
    }
  },
  '/item/{id}': {
    head: async ctx => {
      const item = values[ctx.params.id];
      if (item) {
        return runtime.noContent(200);
      }
      return runtime.json(400, {
        message: 'not found',
        messageIndex: ctx.requestContext.messageIndex
      });
    },
    delete: async ctx => {
      delete values[ctx.params.id];
      return runtime.noContent(204);
    },
    get: async ctx => {
      const item = values[ctx.params.id];
      if (item) {
        return runtime.json(200, item);
      }
      return runtime.json(400, {
        message: 'not found',
        messageIndex: ctx.requestContext.messageIndex
      });
    }
  }
};

let index = 0;

// 'koaAdapter.bind' binds the endpoint implemantion in 'spec' to
// koa-router routes using a koa adapter
const routes = koaAdapter.bind(api.createRouter<RequestContext>(), spec, () => ({
  messageIndex: index++
}));

// finally we can create a Koa app from the routes
export function createApp() {
  // we need a bodyparser to make body contain json and deal with multipart requests
  return new Koa().use(koaBody({ multipart: true })).use(routes.routes());
}

```

## Client usage

Oats generates also client side definitions that can be adapted to http client backends for node.
See for example the [axios adapter](https://github.com/smartlyio/oats/tree/master/packages/oats-axios-adapter). The
generated client provides a fluent interface so that for each Openapi3 definition
`get: /path/subpath/{pathParameter}` the
generated  api client can be called with `api.path.subpath(pathParameter).get()`. The generated
client will enforce *strict* data validation for both input and output of the calls.

```ts
// yarn ts-node -r tsconfig-paths/register examples/client.ts
import * as api from '../tmp/client/generated';
import * as axiosAdapter from '@smartlyio/oats-axios-adapter';
import * as runtime from '@smartlyio/oats-runtime';
import * as app from './server';
import * as assert from 'assert';

// 'api.client' is the abstract implementation of the client which is then
// mapped to axios requests using 'axiosAdapter'
const apiClient = api.client(axiosAdapter.create());
async function runClient() {
  const posted = await apiClient.item.post({
    headers: {
      authorization: 'Bearer ^-^'
    },
    body: runtime.client.json({ id: 'id', name: 'name' })
  });
  if (posted.status !== 201) {
    return assert.fail('wrong response');
  }
  const stored = await apiClient.item(posted.value.value.id).get();
  if (stored.status !== 200) {
    return assert.fail('wrong response');
  }
  assert(stored.value.value.id === 'id');
  const deleted = await apiClient.item(posted.value.value.id).delete();
  assert(deleted.status === 204);
  return;
}

// spin up the server
const port = 12000;
app.createApp().listen(port, async () => {
  try {
    await runClient();
    process.exit(0);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e);
    process.exit(1);
  }
});

```

## Developing and releasing

### Setup

Install dependencies (Yarn workspaces will link all packages automatically):

```bash
yarn install
```

Build all packages:

```bash
yarn build
```

### Release workflow

This project uses [Lerna](https://lerna.js.org/) in fixed version mode with GitHub Actions for automated versioning and publishing. All packages are versioned together — a change in any package bumps all packages to the same version.

The release process is a **two-step PR flow** driven by labels. Contributors do not need to run any versioning or publishing commands.

#### How to release

1. **Open a pull request** with your changes against `master`.
2. **Add a release label** to the PR: `patch`, `minor`, or `major`.
    - `patch` — bug fixes, small non-breaking changes
    - `minor` — new features, non-breaking additions
    - `major` — breaking changes
    - `no-release` — changes that should not trigger a release (docs, CI, refactors)
3. **The label is required.** A CI check will block merging if no release label is set.
4. **Merge the PR.**

After merge, the **Version workflow** (`version.yml`) automatically:
- Determines the bump type from merged PR labels (highest wins: major > minor > patch)
- Bumps all package versions via `lerna version` (fixed mode)
- Opens (or updates) a **version bump PR** titled `chore: version packages vX.Y.Z`
- The version bump PR includes the titles of all included feature PRs

5. **Review and merge the version bump PR.**

After the version bump PR is merged, the **Publish workflow** (`publish.yml`) automatically:
- Creates and pushes a `v{VERSION}` git tag
- Publishes each package to npm via `npm publish`

If multiple feature PRs are merged before the version bump PR is reviewed, the Version workflow updates the existing PR with the latest cumulative bump.

#### What if publishing fails?

Publishing is idempotent — each package version is checked against the npm registry before publishing. Already-published versions are skipped, so re-running after a partial failure only publishes what's missing. To retry, re-run the Publish workflow from the GitHub Actions tab.

> Publishing uses `npm publish` directly for each package (see `.github/scripts/publish-packages.sh`)
> rather than `lerna publish`, which avoids known issues with Lerna's Yarn registry proxy.

#### CI checks on pull requests

| Check | What it does |
|---|---|
| **Release Label Check** | Fails if no release label is set. Ensures exactly one of `patch`, `minor`, `major`, or `no-release` is present. |
| **CI** | Builds, lints, and tests the project. |
| **NPM Token Check** | Verifies the npm publish token is valid and not about to expire. Fails if expired or expiring within 14 days; warns at 30 days. |

#### NPM token rotation

The npm publish token (`NPM_TOKEN`) expires every 90 days. The NPM Token Check workflow catches this early, during PR review rather than at publish time.

When rotating the token:

1. Go to [npmjs.com token settings](https://www.npmjs.com/settings/smartlyio/tokens)
2. Generate a new **Automation** token with publish access
3. Update the `NPM_TOKEN` [repository secret](https://github.com/smartlyio/oats/settings/secrets/actions)
4. Update the `NPM_TOKEN_EXPIRY` [repository variable](https://github.com/smartlyio/oats/settings/variables/actions) with the new expiration date (YYYY-MM-DD format)


## Testing

We support also property based testing and test data generation with
[fast-check](https://github.com/dubzzz/fast-check) through
[oats-fast-check](https://github.com/smartlyio/oats/tree/master/packages/oats-fast-check)