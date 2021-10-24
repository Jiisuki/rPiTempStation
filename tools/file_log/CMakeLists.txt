# Create library.
add_executable(file_log file_log.cpp)

target_link_libraries(file_log common)
target_link_libraries(file_log gr_ipc)

target_link_libraries(file_log stdc++fs)
