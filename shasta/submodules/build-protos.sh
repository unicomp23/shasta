git submodule update --init --recursive .
npx buf generate shasta-proto/proto/tag_data.proto
npx buf generate internal.proto
