# Create library.
add_library(cpu_temp cpu_temp.cpp)

# Make interface available.
target_include_directories(cpu_temp INTERFACE .)

target_link_libraries(cpu_temp gr_ipc)
