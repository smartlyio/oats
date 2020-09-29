# Fast-check generators for smartlyio/oats

[Fast-check](https://www.npmjs.com/package/fast-check)  generators for [@smartlyio/oats](https://www.npmjs.com/package/@smartlyio/oats) types.


## generator.named

Generate values of named types from the openapi specification. Here using a jest wrapper.

```ts
>>examples/type.spec.ts
```

## generator.override

Override automatic generators globally with a custom Arbitrary

```
>>examples/override.spec.ts
```

