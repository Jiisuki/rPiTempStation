cmake_minimum_required(VERSION 3.13)
project(rPiTempStation)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CMAKE_CXX_FLAGS -Wall)
set(CMAKE_CXX_FLAGS -Wno-psabi)

# For some reason, we need this to build in WSL/Debian
set(CMAKE_CXX_FLAGS -pthread)

# load in pkg-config support
#find_package(PkgConfig)

# use pkg-config to get hints for 0mq locations
#pkg_check_modules(PC_ZeroMQ QUIET zmq)

# use the hint from above to find where 'zmq.hpp' is located
#find_path(ZeroMQ_INCLUDE_DIR NAMES zmq.hpp PATHS ${PC_ZeroMQ_INCLUDE_DIRS})

# use the hint from about to find the location of libzmq
#find_library(ZeroMQ_LIBRARY NAMES zmq PATHS ${PC_ZeroMQ_LIBRARY_DIRS})

add_executable(rPiTempStation main.cpp)

## add the include directory to our compile directives
#target_include_directories(rPiTempStation PUBLIC ${ZeroMQ_INCLUDE_DIR})

## at the 0mq library to our link directive
#target_link_libraries(rPiTempStation PUBLIC ${ZeroMQ_LIBRARY})

add_subdirectory(modules/cpu_temp)

target_link_libraries(rPiTempStation cpu_temp)
