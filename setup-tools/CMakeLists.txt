cmake_minimum_required(VERSION 3.5)

include(cmake/cable/bootstrap.cmake)
include(CableBuildType)
include(CableCompilerSettings)
include(CableToolchains)
include(GNUInstallDirs)


option(
    DOCKER
    "remove unneccesary options for pos-processing docker images"
    OFF
)

if (DOCKER)
set(CMAKE_CXX_STANDARD 11)
else()
cable_configure_toolchain(DEFAULT cxx17-pic)
endif()

include(HunterConfig)

cable_set_build_type(DEFAULT Release CONFIGURATION_TYPES Debug Release)

set(PROJECT_VERSION 0.1.0)
project(aztec-trusted-setup)

if (NOT DOCKER)
cable_configure_compiler(NO_PEDANTIC NO_CONVERSION_WARNINGS)
endif()

set(include_dir ${CMAKE_CURRENT_SOURCE_DIR}/include)

set(private_include_dir ${PROJECT_SOURCE_DIR}/src)
set(DEPENDS_DIR ${PROJECT_SOURCE_DIR}/depends)

SET(CMAKE_CXX_FLAGS  "${CMAKE_CXX_FLAGS} -Wno-unused-parameter")

### SETUP
# Create a directory to store the trusted setup output
add_custom_target(create-setup-db-directory ALL
    COMMAND ${CMAKE_COMMAND} -E make_directory ${PROJECT_SOURCE_DIR}/setup_db)

### DEPENDENCIES

# GMP
find_path(GMP_INCLUDE_DIR NAMES gmp.h)
find_library(GMP_LIBRARIES NAMES gmp libgmp)
find_library(GMPXX_LIBRARIES NAMES gmpxx libgmpxx)

option(
    ENABLE_LIBFF_PROFILING
    "Enable libff performance profiling"
    OFF
)
if("${ENABLE_LIBFF_PROFILING}")
  add_definitions(-DENABLE_LIBFF_PROFILING)
endif()

# SET LIBFF CURVE TO ALT_BN128
set(
  CURVE
  "ALT_BN128"
  CACHE
  STRING
  "Default curve: one of ALT_BN128, BN128, EDWARDS, MNT4, MNT6"
)

set(USE_ASM ON)

# DEFAULT MULTICORE OFF
option(
  MULTICORE
  "Enable parallelized execution, using OpenMP"
  OFF
)

# DEFAULT PROCPS OFF
option(
  WITH_PROCPS
  "Use procps for memory profiling"
  OFF
)

# Seriously, turn this damn thing off
add_definitions(
-DNO_PROCPS
)


add_subdirectory(depends)

add_subdirectory(src)

option(SETUP_TESTING "Build tests" ON)

if(SETUP_TESTING AND NOT DOCKER)
    enable_testing()
    add_subdirectory(test)
endif()
