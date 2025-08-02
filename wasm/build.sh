#!/bin/bash

# Enhanced build script for multiple WASM modules with aggressive size optimization
# Designed to meet GitHub Pages size constraints

set -e  # Exit on any error

echo "🦀 Building WASM modules with size optimization..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "❌ wasm-pack is not installed. Please install it with:"
    echo "curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh"
    exit 1
fi

# Create output directory
mkdir -p ../public/wasm

# Function to build a single module
build_module() {
    local module_name=$1
    local features=$2
    local output_name=$3

    echo "📦 Building $module_name module..."

    # Build with specific features if provided
    if [ -n "$features" ]; then
        wasm-pack build \
            --target web \
            --out-dir ../public/wasm \
            --release \
            --no-typescript \
            --no-pack \
            --features "$features" \
            -- --bin "$module_name"
    else
        wasm-pack build \
            --target web \
            --out-dir ../public/wasm \
            --release \
            --no-typescript \
            --no-pack
    fi

    # Rename output files if needed
    if [ -n "$output_name" ] && [ "$output_name" != "portfolio_wasm" ]; then
        mv ../public/wasm/portfolio_wasm.js "../public/wasm/${output_name}.js" 2>/dev/null || true
        mv ../public/wasm/portfolio_wasm_bg.wasm "../public/wasm/${output_name}_bg.wasm" 2>/dev/null || true
    fi
}

# Build core module (default)
echo "🔧 Building core module..."
build_module "core" "" "portfolio_wasm"

# Post-build optimizations
optimize_wasm_files() {
    echo "🚀 Running post-build optimizations..."

    for wasm_file in ../public/wasm/*.wasm; do
        if [ -f "$wasm_file" ]; then
            echo "Optimizing $(basename "$wasm_file")..."

            if command -v wasm-opt &> /dev/null; then
                wasm-opt -Oz \
                    --enable-bulk-memory \
                    --enable-nontrapping-float-to-int \
                    --enable-sign-ext \
                    --enable-simd \
                    "$wasm_file" -o "$wasm_file"
            else
                echo "⚠️  wasm-opt not found. Install binaryen for additional size optimization:"
                echo "   npm install -g binaryen"
            fi
        fi
    done
}

optimize_wasm_files

# Compress with gzip if available
if command -v gzip &> /dev/null; then
    echo "📦 Creating gzipped versions for better compression..."
    gzip -9 -k -f ../public/wasm/*.wasm 2>/dev/null || true
    gzip -9 -k -f ../public/wasm/*.js 2>/dev/null || true
fi

# Generate build report
generate_build_report() {
    echo ""
    echo "📊 Build Report:"
    echo "================"

    total_uncompressed=0
    total_compressed=0

    for file in ../public/wasm/*; do
        if [[ -f "$file" && ! "$file" =~ \.gz$ && ! "$file" =~ \.gitignore$ ]]; then
            filename=$(basename "$file")

            # Get file sizes
            if [[ "$OSTYPE" == "darwin"* ]]; then
                size=$(stat -f%z "$file" 2>/dev/null || echo "0")
            else
                size=$(stat -c%s "$file" 2>/dev/null || echo "0")
            fi

            # Check for compressed version
            compressed_size="N/A"
            if [ -f "${file}.gz" ]; then
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    compressed_size=$(stat -f%z "${file}.gz" 2>/dev/null || echo "0")
                else
                    compressed_size=$(stat -c%s "${file}.gz" 2>/dev/null || echo "0")
                fi
                total_compressed=$((total_compressed + compressed_size))
            fi

            total_uncompressed=$((total_uncompressed + size))

            # Format sizes
            size_formatted=$(numfmt --to=iec $size 2>/dev/null || echo "${size}B")
            if [ "$compressed_size" != "N/A" ]; then
                compressed_formatted=$(numfmt --to=iec $compressed_size 2>/dev/null || echo "${compressed_size}B")
                compression_ratio=$(echo "scale=1; $compressed_size * 100 / $size" | bc 2>/dev/null || echo "N/A")
                echo "   $filename: $size_formatted → $compressed_formatted (${compression_ratio}%)"
            else
                echo "   $filename: $size_formatted"
            fi
        fi
    done

    echo ""
    echo "📈 Summary:"
    total_uncompressed_formatted=$(numfmt --to=iec $total_uncompressed 2>/dev/null || echo "${total_uncompressed}B")
    echo "   Total uncompressed: $total_uncompressed_formatted"

    if [ $total_compressed -gt 0 ]; then
        total_compressed_formatted=$(numfmt --to=iec $total_compressed 2>/dev/null || echo "${total_compressed}B")
        overall_compression=$(echo "scale=1; $total_compressed * 100 / $total_uncompressed" | bc 2>/dev/null || echo "N/A")
        echo "   Total compressed: $total_compressed_formatted (${overall_compression}%)"
    fi

    # Size warnings for GitHub Pages constraints
    size_limit=$((500 * 1024))  # 500KB total limit
    if [ $total_uncompressed -gt $size_limit ]; then
        echo "⚠️  Total size exceeds 500KB limit - consider optimization"
    else
        remaining=$((size_limit - total_uncompressed))
        remaining_formatted=$(numfmt --to=iec $remaining 2>/dev/null || echo "${remaining}B")
        echo "✅ Within size limits. Remaining: $remaining_formatted"
    fi
}

# Check if build was successful
if [ -f "../public/wasm/portfolio_wasm.js" ]; then
    echo "✅ WASM build completed successfully!"
    generate_build_report
    echo ""
    echo "🎯 Build optimization complete!"
else
    echo "❌ WASM build failed!"
    exit 1
fi
