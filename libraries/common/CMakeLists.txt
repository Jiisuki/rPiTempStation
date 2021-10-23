# Create library.
add_library(common INTERFACE)

# Make interface available.
target_include_directories(common INTERFACE ${CMAKE_CURRENT_SOURCE_DIR})

