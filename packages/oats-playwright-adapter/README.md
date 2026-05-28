# Playwright client adapter for smartlyio/oats

See [smartlyio/oats](https://github.com/smartlyio/oats)

Bind generated client definitions to Playwright's `APIRequestContext` (for example the `request` fixture in `@playwright/test`):

```ts
import { test } from '@playwright/test';
import * as adapter from '@smartlyio/oats-playwright-adapter';

test('calls api', async ({ request }) => {
  const api = client(spec => adapter.create(request)(spec));
  await api.get();
});
```

You can also create a standalone context with `playwright.request.newContext()`.
