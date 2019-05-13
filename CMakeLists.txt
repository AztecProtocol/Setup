cmake_minimum_required(VERSION 3.0.0)

include(cmake/cable/bootstrap.cmake)
include(CableBuildType)
include(CableCompilerSettings)
include(CableToolchains)
include(GNUInstallDirs)

cable_configure_toolchain(DEFAULT cxx17-pic)
cable_set_build_type(DEFAULT Release CONFIGURATION_TYPES Debug Release)

project(aztec-trusted-setup)
set(PROJECT_VERSION 0.1.0-dev)

# GMP
find_path(GMP_INCLUDE_DIR NAMES gmp.h)
find_library(GMP_LIBRARIES NAMES gmp libgmp)
find_library(GMPXX_LIBRARIES NAMES gmpxx libgmpxx)

# LIBFF
find_path(LIBFF_INCLUDE_DIR NAMES libff HINTS /usr/local/include)
find_library(LIBFF_LIBRARY NAMES libff.a HINTS /usr/local/lib/libff.a)
message(STATUS "LIBFF: ${LIBFF_LIBRARY} (${LIBFF_INCLUDE_DIR})")
add_library(libff IMPORTED STATIC "${LIBFF_LIBRARY}")

# LIBFQFFT
find_path(LIBFQFFT_INCLUDE_DIR NAMES libfqfft HINTS /usr/local/include)
set(LIBFQFFT_DIRECTORY ${LIBFQFFT_INCLUDE_DIR}/libfqfft)
message(STATUS "LIBFQFFT: ${LIBFQFFT_INCLUDE_DIR}")
include_directories(${LIBFQFFT_DIRECTORY})

cable_configure_compiler(NO_PEDANTIC NO_CONVERSION_WARNINGS)

set(include_dir ${CMAKE_CURRENT_SOURCE_DIR}/include)

add_subdirectory(src)

if(SETUP_TESTING)
    enable_testing()
    add_subdirectory(test)
endif()
