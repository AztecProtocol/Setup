if (NOT DOCKER)
add_subdirectory(generator)
add_subdirectory(setup)
endif()

add_subdirectory(aztec_common)
add_subdirectory(range)
add_subdirectory(range-prep)
