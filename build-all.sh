set -e

cd runtime
yarn & yarn build
yarn link
cd ..

cd adapters/koa
yarn
yarn link @smartlyio/oats-runtime
yarn build
yarn link
cd ..

cd adapters/axios
yarn
yarn link @smartlyio/oats-runtime
yarn build
yarn link
cd ..

yarn
yarn link @smartlyio/oats-runtime
yarn link @smartlyio/oats-koa-adapter
yarn link @smartlyio/oats-axios-adapter
yarn build
