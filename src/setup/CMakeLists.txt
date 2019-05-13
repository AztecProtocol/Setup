
# trusted_setup_post_processing setup
# copyright spilsbury holdings 2019


add_executable(
    setup
    setup.tcc
    setup.hpp
    main.cpp
)

target_link_libraries(
    setup
    ff
    ${GMP_LIBRARIES}
)

target_include_directories(
    setup
    PUBLIC
        ${DEPENDS_DIR}/libff
    PRIVATE
        ${private_include_dir}
)