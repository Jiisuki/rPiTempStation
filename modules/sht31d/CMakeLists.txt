# Create library.
add_library(sht31d sht31d.cpp)

# Make interface available.
target_include_directories(sht31d INTERFACE .)

target_link_libraries(sht31d gr_ipc)
