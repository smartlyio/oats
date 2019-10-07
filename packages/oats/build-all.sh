set -e

pushd runtime
yarn & yarn build
yarn link
popd

pushd adapters/koa
yarn
yarn link @smartlyio/oats-runtime
yarn build
yarn link
popd

pushd adapters/axios
yarn
yarn link @smartlyio/oats-runtime
yarn build
yarn link
popd

yarn
yarn link @smartlyio/oats-runtime
yarn link @smartlyio/oats-koa-adapter
yarn link @smartlyio/oats-axios-adapter
yarn build
