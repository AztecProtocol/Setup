find_package (Threads)

add_executable(
    verify
    main.cpp
    verifier.hpp
    verifier.cpp
)

target_link_libraries(
    verify
    PRIVATE
        ff
        ${CMAKE_THREAD_LIBS_INIT}
        ${GMP_LIBRARIES}
        aztec_common
)

target_include_directories(
    verify
    PRIVATE
        ${DEPENDS_DIR}/libff
        ${DEPENDS_DIR}/blake2b/ref
        ${private_include_dir}
)

set_target_properties(verify PROPERTIES RUNTIME_OUTPUT_DIRECTORY ../..)
