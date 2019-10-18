
# trusted_setup_post_processing range
# copyright spilsbury holdings 2019

find_package (Threads)
find_package (OpenMP)

add_executable(
    generate_h
    range_multi_exp.hpp
    range_multi_exp.cpp
    main.cpp
)

if(OpenMP_CXX_FOUND)
    target_link_libraries(generate_h PUBLIC OpenMP::OpenMP_CXX)
endif()

target_link_libraries(
    generate_h
    PRIVATE
        aztec_common
        ff
        ${CMAKE_THREAD_LIBS_INIT}
        ${GMP_LIBRARIES}
        barretenberg
)

target_include_directories(
    generate_h
    PRIVATE
        ${DEPENDS_DIR}/libff
        ${DEPENDS_DIR}/libfqfft
        ${include_dir}
        ${private_include_dir}
        ${DEPENDS_DIR}/barretenberg/src
)

set_target_properties(generate_h PROPERTIES RUNTIME_OUTPUT_DIRECTORY ../..)
