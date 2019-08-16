find_package (Threads)

add_executable(
    print_point
    main.cpp
)

target_link_libraries(
    print_point
    PRIVATE
        ff
        ${CMAKE_THREAD_LIBS_INIT}
        ${GMP_LIBRARIES}
        aztec_common
)

target_include_directories(
    print_point
    PRIVATE
        ${DEPENDS_DIR}/libff
        ${DEPENDS_DIR}/blake2b/ref
        ${private_include_dir}
)

set_target_properties(print_point PROPERTIES RUNTIME_OUTPUT_DIRECTORY ../..)
