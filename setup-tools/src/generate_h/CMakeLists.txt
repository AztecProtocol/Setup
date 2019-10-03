
# trusted_setup_post_processing range
# copyright spilsbury holdings 2019

find_package (Threads)


add_executable(
    generate_h
    range_multi_exp.hpp
    range_multi_exp.cpp
    main.cpp
)

target_link_libraries(
    generate_h
    PRIVATE
        aztec_common
        ff
        ${CMAKE_THREAD_LIBS_INIT}
        ${GMP_LIBRARIES}
)

target_include_directories(
    generate_h
    PRIVATE
        ${DEPENDS_DIR}/libff
        ${DEPENDS_DIR}/libfqfft
        ${include_dir}
        ${private_include_dir}
)

set_target_properties(generate_h PROPERTIES RUNTIME_OUTPUT_DIRECTORY ../..)
