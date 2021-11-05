# Create library.
add_executable(monitor monitor.cpp)

target_link_libraries(monitor common)
target_link_libraries(monitor gr_ipc)

# Add required external library Curses.
find_package(Curses REQUIRED)
include_directories(${CURSES_INCLUDE_DIR})
target_link_libraries(monitor ${CURSES_LIBRARIES})
