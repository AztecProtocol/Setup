cmake_minimum_required(VERSION 3.5)

include(cmake/cable/bootstrap.cmake)
include(CableBuildType)
include(CableCompilerSettings)
include(CableToolchains)
include(GNUInstallDirs)

cable_configure_toolchain(DEFAULT cxx17-pic)

include(HunterConfig)

cable_set_build_type(DEFAULT Release CONFIGURATION_TYPES Debug Release)

set(PROJECT_VERSION 0.1.0)
project(aztec-trusted-setup)

cable_configure_compiler(NO_PEDANTIC NO_CONVERSION_WARNINGS)

set(include_dir ${CMAKE_CURRENT_SOURCE_DIR}/include)
set(setup_test_dir ${CMAKE_CURRENT_SOURCE_DIR}/test/setup)
set(deepstate_test_dir ${CMAKE_CURRENT_SOURCE_DIR}/test/deepstate-tests)

set(private_include_dir ${PROJECT_SOURCE_DIR}/src)
set(DEPENDS_DIR ${PROJECT_SOURCE_DIR}/depends)

SET(CMAKE_CXX_FLAGS  "${CMAKE_CXX_FLAGS} -Wno-unused-parameter")
set(CMAKE_CXX_OUTPUT_EXTENSION_REPLACE ON)

option(
    GENCOV
    "Enable gcov instrumentation"
    OFF
)
if("${GENCOV}")
  SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -g -fprofile-arcs -ftest-coverage")
endif()

message(STATUS "GENCOV: ${GENCOV}")

### SETUP
# Create a directory to store the trusted setup output
add_custom_target(create-setup-db-directory ALL
    COMMAND ${CMAKE_COMMAND} -E make_directory ${PROJECT_SOURCE_DIR}/setup_db)

# regular gcov reporting with setup_tests
add_custom_target(cov
    COMMAND ${CMAKE_COMMAND} -E make_directory cov_out
    COMMAND ${CMAKE_CTEST_COMMAND} -R setup
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR})
add_custom_command(TARGET cov
    COMMAND echo "=================== GCOV ===================="
	COMMAND echo "${setup_test_dir}"
    COMMAND gcov -b ${setup_test_dir}/*.cpp -o ${CMAKE_BINARY_DIR}/test/setup/CMakeFiles/setup_tests.dir/
    COMMAND echo "-- Coverage files have been output to ${CMAKE_BINARY_DIR}/cov_out"
    COMMAND echo "=================== GCOV ===================="
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}/cov_out)

# gcov reporting for deepstate_tests
add_custom_target(dcov
    COMMAND ${CMAKE_COMMAND} -E make_directory dcov_out
    COMMAND ${CMAKE_CTEST_COMMAND} -R deepstate_test
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR})
add_custom_command(TARGET dcov
    COMMAND echo "=================== GCOV ===================="
    COMMAND echo "${deepstate_test_dir}"
    COMMAND gcov -b ${deepstate_test_dir}/*.cpp -o ${CMAKE_BINARY_DIR}/test/deepstate-tests/CMakeFiles/deepstate_tests.dir/
    COMMAND echo "-- Coverage files have been output to ${CMAKE_BINARY_DIR}/dcov_out"
    COMMAND echo "=================== GCOV ===================="
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}/dcov_out)


### DEPENDENCIES

# GMP
find_path(GMP_INCLUDE_DIR NAMES gmp.h)
find_library(GMP_LIBRARIES NAMES gmp libgmp)
find_library(GMPXX_LIBRARIES NAMES gmpxx libgmpxx)

add_compile_options(-fno-stack-protector)
add_compile_options(-Wno-unused-const-variable)

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

# DEFAULT SIMULATE_PARTICIPANT OFF
option(
  SIMULATE_PARTICIPANT
  "Setup toxic waste is hash of previous transcript"
  OFF
)
if("${SIMULATE_PARTICIPANT}")
  add_definitions(-DSIMULATE_PARTICIPANT)
endif()

message(STATUS "SIMULATE_PARTICIPANT: ${SIMULATE_PARTICIPANT}")


# DEFAULT USE_CXX11_ABI OFF
option(
  USE_CXX11_ABI
  "Set to link to libraries that use legacy ABI (GCC 5.x)"
  OFF
)
if("${USE_CXX11_ABI}")
  add_definitions(-D_GLIBCXX_USE_CXX11_ABI=0)
endif()

message(STATUS "USE_CXX11_ABI: ${USE_CXX11_ABI}")

add_subdirectory(depends)

add_subdirectory(src)

option(SETUP_TESTING "Build tests" ON)

if(SETUP_TESTING)
  enable_testing()
  add_subdirectory(test)
  add_test(deepstate_test ${CMAKE_CURRENT_BINARY_DIR}/test/deepstate_tests)
endif()
