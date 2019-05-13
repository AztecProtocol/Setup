
# trusted_setup_post_processing setup
# copyright spilsbury holdings 2019


add_executable(setup setup.tcc setup.hpp main.cpp)
target_link_libraries(setup common libff.a ${GMP_LIBRARIES})
target_include_directories(setup PUBLIC ${DEPENDS_DIR}/libfqfft)