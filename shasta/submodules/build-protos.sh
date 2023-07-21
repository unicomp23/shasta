dir=shasta-proto
repo=git@github.com:airtimemedia/shasta-proto.git

# check if the directory does not exist
if [ ! -d "$dir" ]; then
  # run git clone
  git clone -b "feature/SHASTA-26-Mocha-tests" "$repo" "$dir"
else
  echo "Directory $dir already exists"
fi

npx buf generate shasta-proto/proto/tag_data.proto
