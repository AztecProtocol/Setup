
# trusted_setup_post_processing range
# copyright spilsbury holdings 2019

find_package (Threads)


add_executable(
    compute_range_polynomial
    range_multi_exp.hpp
    range_multi_exp.cpp
    main.cpp
)

target_link_libraries(
    compute_range_polynomial
    PRIVATE
        aztec_common
        ff
        ${CMAKE_THREAD_LIBS_INIT}
        ${GMP_LIBRARIES}
)

target_include_directories(
    compute_range_polynomial
    PRIVATE
        ${DEPENDS_DIR}/libff
        ${DEPENDS_DIR}/libfqfft
        ${include_dir}
        ${private_include_dir}
)

set_target_properties(compute_range_polynomial PROPERTIES RUNTIME_OUTPUT_DIRECTORY ../..)
