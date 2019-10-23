# trusted_setup_post_processing setup
# copyright spilsbury holdings 2019

find_package (Threads)

# Standard setup binary.
add_executable(
    setup
    setup.cpp
    setup.hpp
    utils.hpp
    main.cpp
)

target_link_libraries(
    setup
    PRIVATE
        ff
        ${CMAKE_THREAD_LIBS_INIT}
        ${GMP_LIBRARIES}
        aztec_common
)

target_include_directories(
    setup
    PRIVATE
        ${DEPENDS_DIR}/libff
        ${DEPENDS_DIR}/blake2b/ref
        ${private_include_dir}
)

set_target_properties(setup PROPERTIES RUNTIME_OUTPUT_DIRECTORY ../..)

# Super fast binary. Includes Barretenberg.
add_executable(
    setup-fast
    setup.cpp
    setup.hpp
    utils.hpp
    main.cpp
)

target_link_libraries(
    setup-fast
    PRIVATE
        ff
        ${CMAKE_THREAD_LIBS_INIT}
        ${GMP_LIBRARIES}
        aztec_common
        barretenberg
)

target_include_directories(
    setup-fast
    PRIVATE
        ${DEPENDS_DIR}/libff
        ${DEPENDS_DIR}/blake2b/ref
        ${private_include_dir}
        ${DEPENDS_DIR}/barretenberg/src
)

target_compile_definitions(setup-fast PRIVATE SUPERFAST=1)

set_target_properties(setup-fast PROPERTIES RUNTIME_OUTPUT_DIRECTORY ../..)

# Sealing binary. Toxic waste is hash of previous transcripts. Includes barretenberg.
add_executable(
    seal
    setup.cpp
    setup.hpp
    utils.hpp
    main.cpp
)

target_link_libraries(
    seal
    PRIVATE
        ff
        ${CMAKE_THREAD_LIBS_INIT}
        ${GMP_LIBRARIES}
        aztec_common
        barretenberg
)

target_include_directories(
    seal
    PRIVATE
        ${DEPENDS_DIR}/libff
        ${DEPENDS_DIR}/blake2b/ref
        ${private_include_dir}
        ${DEPENDS_DIR}/barretenberg/src
)

target_compile_definitions(seal PRIVATE SEALING=1)

set_target_properties(seal PROPERTIES RUNTIME_OUTPUT_DIRECTORY ../..)