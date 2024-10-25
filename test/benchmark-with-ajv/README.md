# Benchmark against ajv

Run `yarn generate` in root directory to generate the necessary artifacts. This will generate type definitions and the
openapi schema for the bencmark test data.

Run the benchmark.spec.ts test using jest. Note that the benchmark test does not fail but outputs timing information to
console.log.

Sizes of the data can be configured in the test file. Note however that the generated data must match the schema in
api.yml

## Change the benchmark schema

The benchmark schema in api.yml is generated from an ejs template in api.yml.ejs.

