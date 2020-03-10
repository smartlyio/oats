set -e
rm -rf node_modules

cd runtime
echo "building $PWD"
rm -rf node_modules
yarn
yarn build
yarn link
cd ..

cd adapters/koa
echo "building $PWD"
rm -rf node_modules
yarn link @smartlyio/oats-runtime
yarn
yarn build
yarn link
cd ../..

cd adapters/axios
echo "building $PWD"
rm -rf node_modules
yarn link @smartlyio/oats-runtime
yarn
yarn build
yarn link
cd ../..

echo "building $PWD"
yarn link @smartlyio/oats-runtime
yarn link @smartlyio/oats-koa-adapter
yarn link @smartlyio/oats-axios-adapter
yarn
yarn build
