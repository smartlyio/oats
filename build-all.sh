set -e

pushd runtime
yarn & yarn build
yarn link
popd

pushd adapters/koa
yarn link @smartlyio/oats-runtime
yarn && yarn build
yarn link
popd

pushd adapters/axios
yarn link @smartlyio/oats-runtime
yarn & yarn build
yarn link
popd

yarn link @smartlyio/oats-runtime
yarn link @smartlyio/oats-koa-adapter
yarn link @smartlyio/oats-axios-adapter
yarn && yarn build
