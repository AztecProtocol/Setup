add_subdirectory(libff)

OPTION(IS_LIBFQFFT_PARENT OFF)
add_subdirectory(libfqfft)

add_library(
    blake2 STATIC
    ${DEPENDS_DIR}/blake2/ref/blake2b-ref.c
    ${DEPENDS_DIR}/blake2/ref/blake2-impl.h
    ${DEPENDS_DIR}/blake2/ref/blake2.h
)

OPTION(BARRETENBERG_TESTING OFF)
add_subdirectory(barretenberg)