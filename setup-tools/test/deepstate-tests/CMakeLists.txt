add_executable(
    deepstate_tests
	test_entry_points.cpp
	test_aztec_common.cpp
	test_setup.cpp
	test_compute_range_polynomial.cpp
	../../src/verify/verifier.cpp
)

target_link_libraries(
    deepstate_tests
    PRIVATE
        ff
        aztec_common
		-ldeepstate_AFL
		-pthread
)

target_include_directories(
    deepstate_tests
    PRIVATE
        ${PROJECT_SOURCE_DIR}/depends/libfqfft
        ${private_include_dir}
        ${include_dir}
)

set_target_properties(
    deepstate_tests
    PROPERTIES RUNTIME_OUTPUT_DIRECTORY ..
)
