cmake_minimum_required(VERSION 3.20)

project(clang-format-wasm)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Set Emscripten flags for WASM
if(EMSCRIPTEN)
    set(CMAKE_EXECUTABLE_SUFFIX ".js")
    
    # Common Emscripten flags
    set(EMSCRIPTEN_FLAGS
        -O3
        -sWASM=1
        -sEXPORTED_RUNTIME_METHODS=['ccall','cwrap']
        -sALLOW_MEMORY_GROWTH=1
        -sMODULARIZE=1
        -sEXPORT_NAME='Module'
        -sENVIRONMENT=web,webview,worker
        -sUSE_ES6_IMPORT_META=0
        --no-entry
    )
    
    # Library-specific flags
    set(LIB_EMSCRIPTEN_FLAGS
        ${EMSCRIPTEN_FLAGS}
        -sEXPORTED_FUNCTIONS=['_malloc','_free']
        --bind
    )
    
    # CLI-specific flags  
    set(CLI_EMSCRIPTEN_FLAGS
        ${EMSCRIPTEN_FLAGS}
        -sEXPORTED_FUNCTIONS=['_main']
        -sINVOKE_RUN=0
        -sNODERAWFS=1
    )
endif()

# Find LLVM
find_package(LLVM REQUIRED CONFIG)
message(STATUS "Found LLVM ${LLVM_PACKAGE_VERSION}")
message(STATUS "Using LLVMConfig.cmake in: ${LLVM_DIR}")

# Include LLVM headers
include_directories(${LLVM_INCLUDE_DIRS})
add_definitions(${LLVM_DEFINITIONS})

# Find Clang
find_package(Clang REQUIRED CONFIG)

# Get LLVM components
llvm_map_components_to_libnames(llvm_libs support core)

# Define source files
set(LIB_SOURCES
    lib.cc
    lib.h
    binding.cc
)

set(CLI_SOURCES
    cli.cc
)

# Create library target
add_executable(clang-format-wasm ${LIB_SOURCES})

# Link against Clang and LLVM libraries
target_link_libraries(clang-format-wasm
    clangFormat
    clangToolingCore
    clangBasic
    clangRewrite
    ${llvm_libs}
)

# Create CLI target
add_executable(clang-format-cli ${CLI_SOURCES})

target_link_libraries(clang-format-cli
    clangFormat
    clangToolingCore
    clangBasic
    clangRewrite
    ${llvm_libs}
)

# Set Emscripten flags
if(EMSCRIPTEN)
    # Configure library target
    set_target_properties(clang-format-wasm PROPERTIES
        COMPILE_FLAGS "${LIB_EMSCRIPTEN_FLAGS}"
        LINK_FLAGS "${LIB_EMSCRIPTEN_FLAGS}"
        OUTPUT_NAME "clang-format-esm"
    )
    
    # Configure CLI target
    set_target_properties(clang-format-cli PROPERTIES
        COMPILE_FLAGS "${CLI_EMSCRIPTEN_FLAGS}"
        LINK_FLAGS "${CLI_EMSCRIPTEN_FLAGS}"
        OUTPUT_NAME "clang-format-cli"
    )
endif()