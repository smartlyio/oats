# Axios client adapter for smartlyio/oats

See [smartlyio/oats](https://github.com/smartlyio/oats)

This adapter provides two ways to bind the generated client definitions

```ts
import * as adapter from '@smartlyio/oats-axios-adapter';

// bind the default axios instance
adapter.bind(definitions);

// provide your own axios instance
adapter.withAxios(someAxiosInstance)(definitions);
```

