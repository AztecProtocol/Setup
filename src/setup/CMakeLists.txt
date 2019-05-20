
# trusted_setup_post_processing setup
# copyright spilsbury holdings 2019


add_executable(
    setup
    setup.tcc
    setup.hpp
    utils.hpp
    main.cpp
)

target_link_libraries(
    setup
    PRIVATE
        ff
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
