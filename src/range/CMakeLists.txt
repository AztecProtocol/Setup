
# trusted_setup_post_processing range
# copyright spilsbury holdings 2019


add_executable(
    compute_range_polynomial
    compute_range_polynomial.tcc
    compute_range_polynomial.hpp
    main.cpp
)

target_link_libraries(
    compute_range_polynomial
    PRIVATE
        aztec_common
        ff
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