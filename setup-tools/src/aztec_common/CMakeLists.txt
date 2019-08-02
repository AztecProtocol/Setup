# aztec_common
# copyright spilsbury holdings 2019

add_library(
    aztec_common STATIC
    ${include_dir}/aztec_common.hpp
    batch_normalize.hpp
    checksum.hpp
    compression.hpp
    libff_types.hpp
    streaming_g1.hpp
    streaming_g1.cpp
    streaming_g2.hpp
    streaming_g2.cpp
    streaming_transcript.hpp
    streaming_transcript.cpp
    streaming.hpp
    streaming.cpp
)

set_target_properties(aztec_common PROPERTIES LINKER_LANGUAGE CXX)

target_link_libraries(
    aztec_common
    PUBLIC
        ${GMP_LIBRARIES}
        blake2
)

target_include_directories(
    aztec_common
    PUBLIC
        ${DEPENDS_DIR}/blake2/ref
        ${DEPENDS_DIR}/libff
)

install(
    DIRECTORY
    ${include_dir}/
    DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}
)
