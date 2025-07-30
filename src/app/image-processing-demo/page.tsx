'use client'

import React from 'react'
import ImageProcessingDemo from '@/components/ImageProcessingDemo'

export default function ImageProcessingDemoPage() {
  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              WASM Image Processing Demo
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              This page showcases image processing using Rust based web assembly (WASM). Smaller images typically show a JS performance win, whereas larger images tend to show WASM performance wins.
            </p>
          </div>

          <ImageProcessingDemo />

          <div className="mt-12 bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-white">Technical Implementation</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">WASM Module Features</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Gaussian blur with configurable radius</li>
                  <li>Sobel edge detection algorithm</li>
                  <li>Color filters (sepia, grayscale, invert, channel isolation)</li>
                  <li>Brightness and contrast adjustments</li>
                  <li>Unsharp mask sharpening filter</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">Performance Optimizations</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Compiled with aggressive size optimization flags</li>
                  <li>Efficient memory management with minimal allocations</li>
                  <li>Separable filter implementations for better cache performance</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">Size Constraints</h3>
                <p className="ml-4">
                  The entire WASM module is optimized to stay within GitHub Pages hosting limits,
                  with the compiled binary under 100KB while maintaining full functionality.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-blue-900 border border-blue-700 rounded-lg p-6">
            <h3 className="text-blue-100 font-semibold mb-2">Try These Features</h3>
            <ul className="text-blue-200 space-y-1">
              <li>• Upload your own images to see real-world performance</li>
              <li>• Adjust filter parameters in real-time</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
