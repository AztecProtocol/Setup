
# trusted_setup_post_processing range
# copyright spilsbury holdings 2019

add_executable(
    prep_range_data
    main.cpp
)

target_link_libraries(
    prep_range_data
    PRIVATE
        aztec_common
        ff
        ${CMAKE_THREAD_LIBS_INIT}
        ${GMP_LIBRARIES}
)

target_include_directories(
    prep_range_data
    PRIVATE
        ${DEPENDS_DIR}/libff
        ${DEPENDS_DIR}/libfqfft
        ${include_dir}
        ${private_include_dir}
)

set_target_properties(prep_range_data PROPERTIES RUNTIME_OUTPUT_DIRECTORY ../..)
