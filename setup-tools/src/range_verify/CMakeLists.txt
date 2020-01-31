
# trusted_setup_post_processing range
# copyright spilsbury holdings 2019

find_package (Threads)
find_package (OpenMP)

add_executable(
    verify_range_points
    main.cpp
)

if(OpenMP_CXX_FOUND)
    target_link_libraries(verify_range_points PUBLIC OpenMP::OpenMP_CXX)
endif()

target_link_libraries(
    verify_range_points
    PRIVATE
        aztec_common
        ff
        ${CMAKE_THREAD_LIBS_INIT}
        ${GMP_LIBRARIES}
        barretenberg
)

target_include_directories(
    verify_range_points
    PRIVATE
        ${DEPENDS_DIR}/libff
        ${DEPENDS_DIR}/libfqfft
        ${include_dir}
        ${private_include_dir}
        ${DEPENDS_DIR}/barretenberg/src
)

set_target_properties(verify_range_points PROPERTIES RUNTIME_OUTPUT_DIRECTORY ../..)
