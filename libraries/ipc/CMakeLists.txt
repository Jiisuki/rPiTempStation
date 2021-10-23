# Create library.
add_library(gr_ipc gr_ipc.cpp)

# Make interface available.
target_include_directories(gr_ipc INTERFACE ${CMAKE_CURRENT_SOURCE_DIR})

# load in pkg-config support
#find_package(PkgConfig)

# use pkg-config to get hints for 0mq locations
#pkg_check_modules(PC_ZeroMQ QUIET zmq)

# use the hint from above to find where 'zmq.hpp' is located
#find_path(ZeroMQ_INCLUDE_DIR NAMES zmq.hpp PATHS ${PC_ZeroMQ_INCLUDE_DIRS})

# use the hint from about to find the location of libzmq
#find_library(ZeroMQ_LIBRARY NAMES zmq PATHS ${PC_ZeroMQ_LIBRARY_DIRS})

## add the include directory to our compile directives
#target_include_directories(gr_ipc PUBLIC ${ZeroMQ_INCLUDE_DIR})

## at the 0mq library to our link directive
#target_link_libraries(gr_ipc PUBLIC ${ZeroMQ_LIBRARY})

find_package(cppzmq REQUIRED)

target_link_libraries(gr_ipc PUBLIC cppzmq)
