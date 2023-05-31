PROJECT=shasta

include at-deps/deps.make
include at-deps/make/cmake_helpers.make

### Add direct dependencies to submodules target
submodules: build_tools media-tools-bin

### Bootstrap
at-deps/deps.make: $(if $(filter $(MAKECMDGOALS), update),always,) # always run on update
	git submodule update --init at-deps
at-deps/make/cmake_helpers.make: at-deps/deps.make;
.PHONY: always

shasta-package-setup: release
	cp -Rp shasta $(RELEASE_BUILD_DIR)/shasta-worker

test:
	(cd shasta; npm run test; npm run lint)

clean:
	rm -rf build/
