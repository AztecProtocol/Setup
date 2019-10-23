# aztec_trusted_setup
# Copyright 2019 Spilsbury Holdings Ltd

include(FetchContent)

### DEPENDENCIES
FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG release-1.8.0
)

FetchContent_GetProperties(googletest)
if(NOT googletest_POPULATED)
    FetchContent_Populate(googletest)
    add_subdirectory(${googletest_SOURCE_DIR} ${googletest_BINARY_DIR} EXCLUDE_FROM_ALL)
endif()

mark_as_advanced(
    BUILD_GMOCK BUILD_GTEST BUILD_SHARED_LIBS
    gmock_build_tests gtest_build_samples gtest_build_tests
    gtest_disable_pthreads gtest_force_shared_crt gtest_hide_internal_symbols
)

set(setup_private_include_dir ${PROJECT_SOURCE_DIR}/src)

find_package (OpenMP)

add_executable(
    setup_tests
    test_aztec_common.cpp
    test_setup.cpp
    test_compute_range_polynomial.cpp
    ../src/verify/verifier.cpp
    ../src/range/range_multi_exp.cpp
    ../src/generate_h/range_multi_exp.cpp
    ../src/setup/setup.cpp
)

if(OpenMP_CXX_FOUND)
    target_link_libraries(setup_tests PUBLIC OpenMP::OpenMP_CXX)
endif()

target_compile_options(setup_tests PRIVATE -Wno-sign-compare)

target_link_libraries(
    setup_tests
    PRIVATE
        ff
        aztec_common
        barretenberg
        gtest
        gmock
        gtest_main
)

target_include_directories(
    setup_tests
    PRIVATE
        ${PROJECT_SOURCE_DIR}/depends/libfqfft
        ${private_include_dir}
        ${DEPENDS_DIR}/barretenberg/src
)

set_target_properties(
    setup_tests
    PROPERTIES RUNTIME_OUTPUT_DIRECTORY .
)

add_test(
    TARGET
    setup_tests
    TEST_PREFIX
    ${PROJECT_NAME}/tests/
)

target_compile_definitions(setup_tests PRIVATE SUPERFAST=1)