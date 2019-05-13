# common
# copyright spilsbury holdings 2019

add_library(
    common STATIC
    include/common.hpp
    streaming.tcc
    streaming.hpp
)
set_target_properties(common PROPERTIES LINKER_LANGUAGE CXX)
target_link_libraries(common PUBLIC ${GMP_LIBRARIES})
target_include_directories(common PUBLIC ${include_dir})

install(
    DIRECTORY
    ${include_dir}/
    DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}
)
