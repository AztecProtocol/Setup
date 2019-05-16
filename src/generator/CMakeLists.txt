
# trusted_setup_post_processing
# copyright spilsbury holdings 2019


add_executable(
    compute_generator_polynomial
    compute_generator_polynomial.tcc
    compute_generator_polynomial.hpp main.cpp
)
target_link_libraries(
    compute_generator_polynomial
    PRIVATE
        aztec_common
        ff
        ${GMP_LIBRARIES}
)
target_include_directories(
    compute_generator_polynomial
    PRIVATE
        ${DEPENDS_DIR}/libff/
        ${DEPENDS_DIR}/libfqfft/
        ${private_include_dir}
        ${include_dir}
)