# Create library.
add_executable(monitor monitor.cpp)

target_link_libraries(monitor common)
target_link_libraries(monitor gr_ipc)
