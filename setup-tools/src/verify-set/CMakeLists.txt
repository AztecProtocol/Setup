add_executable(
    verify_set
    main.cpp
)

target_link_libraries(
    verify_set
    PRIVATE
        ${GMP_LIBRARIES}
        aztec_common
        ff
)

target_include_directories(
    verify_set
    PRIVATE
        ${DEPENDS_DIR}/libff
        ${DEPENDS_DIR}/blake2b/ref
        ${private_include_dir}
)

set_target_properties(verify_set PROPERTIES RUNTIME_OUTPUT_DIRECTORY ../..)
