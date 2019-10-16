# aztec_trusted_setup
# Copyright 2019 Spilsbury Holdings Ltd

include(GoogleTest)

set(setup_private_include_dir ${PROJECT_SOURCE_DIR}/src)

add_subdirectory(deepstate-tests)
add_subdirectory(setup)
