
# trusted_setup_post_processing range
# copyright spilsbury holdings 2019

find_package (Threads)
find_package (OpenMP)

add_executable(
    compute_range_polynomial
    range_multi_exp.hpp
    range_multi_exp.cpp
    main.cpp
)

if(OpenMP_CXX_FOUND)
    target_link_libraries(compute_range_polynomial PUBLIC OpenMP::OpenMP_CXX)
endif()

target_link_libraries(
    compute_range_polynomial
    PRIVATE
        aztec_common
        ff
        ${CMAKE_THREAD_LIBS_INIT}
        ${GMP_LIBRARIES}
        barretenberg
)

target_include_directories(
    compute_range_polynomial
    PRIVATE
        ${DEPENDS_DIR}/libff
        ${DEPENDS_DIR}/libfqfft
        ${include_dir}
        ${private_include_dir}
        ${DEPENDS_DIR}/barretenberg/src
)

set_target_properties(compute_range_polynomial PROPERTIES RUNTIME_OUTPUT_DIRECTORY ../..)
