# Oats

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

## Developing and releasing

### Setup

Install dependencies:
```bash
pnpm install
```

Build all packages:

```bash
pnpm build
```

### Release workflow

This project uses a pnpm workspace with GitHub Actions for automated fixed-version releases. All packages are versioned together, so a change in any package bumps all packages to the same version.

The release process is driven entirely by PR labels. Contributors do not need to run any versioning or publishing commands.

#### How to release

1. **Open a pull request** with your changes against `master`.
2. **Add a release label** to the PR: `patch`, `minor`, `major`, or `no-release`.
    - `patch` — bug fixes, small non-breaking changes
    - `minor` — new features, non-breaking additions
    - `major` — breaking changes
    - `no-release` — changes that should not trigger a release (docs, CI, refactors)
3. **The label is required.** A CI check will block merging if no release label is set.
4. **Merge the PR.** That's it — the rest is fully automated.

After merge, a GitHub Action automatically:
- Determines the bump type from the PR label
- Bumps all package versions in fixed mode
- Refreshes `pnpm-lock.yaml` before committing the release bump
- Commits the version bump to `master` with the PR titles as a release log
- Publishes each package to npm via `npm publish` (idempotent — safe to re-run)
- Creates and pushes a `v{VERSION}` git tag

If multiple PRs are merged between releases, the highest bump type wins (major > minor > patch) and all PR titles are included in the version commit.

> Publishing uses `npm publish` directly for each package.
> Each package is published individually, so partial failures show exactly which package failed and re-runs only publish what's missing.

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
