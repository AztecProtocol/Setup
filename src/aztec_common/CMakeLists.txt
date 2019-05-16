# aztec_common
# copyright spilsbury holdings 2019

add_library(
    aztec_common STATIC
    ${include_dir}/aztec_common.hpp
    checksum.hpp
    compression.tcc
    compression.hpp
    streaming.tcc
    streaming.hpp
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
)

install(
    DIRECTORY
    ${include_dir}/
    DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}
)
