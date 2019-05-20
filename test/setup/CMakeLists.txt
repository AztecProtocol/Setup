# aztec_trusted_setup
# Copyright 2019 Spilsbury Holdings Ltd

hunter_add_package(GTest)
find_package(GTest CONFIG REQUIRED)


add_executable(
    setup_tests
    test_asm.cpp
    test_aztec_common.cpp
    test_setup.cpp
    test_compute_range_polynomial.cpp
)
target_link_libraries(
    setup_tests
    PRIVATE
        ff
        GTest::gtest
        GTest::main
)
target_include_directories(
    setup_tests
    PRIVATE
        ${private_include_dir}
        ${include_dir}
)

set_target_properties(
    setup_tests
    PROPERTIES RUNTIME_OUTPUT_DIRECTORY ..
)
gtest_add_tests(
    TARGET
    setup_tests
    TEST_PREFIX
    ${PROJECT_NAME}/tests/
)