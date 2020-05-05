# Nock server adapter for smartlyio/oats

Nock adapter for creating mock servers from openapi definitions using oats.

To mock the request `POST /item` define the route as for any oats server adapter 
and then bind the route defining object to the nock adapter. The bound mock 
servers are namespaced using the OpenApi server strings as nock basepaths  so that 
multiple nock mocks can be used simultanenously so long as the basepaths differ.

```
>>examples/example.ts
```
