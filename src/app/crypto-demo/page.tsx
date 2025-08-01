'use client'

import React from 'react'
import CryptographicDemo from '@/components/CryptographicDemo'

export default function CryptoDemoPage() {
  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              WASM Cryptographic Demo
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              This page showcases cryptographic functions and hash algorithms using Rust-based WebAssembly
              (WASM). Experience real-time hash calculations, encryption/decryption, and cryptographic analysis
              with high-performance implementations.
            </p>
          </div>

          <CryptographicDemo />

          <div className="mt-12 bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-white">
              Technical Implementation
            </h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  WASM Module Features
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Multiple hash algorithms (Simple, FNV-1a, CRC32, Demo MD5/SHA)</li>
                  <li>Classical encryption methods (Caesar, XOR, ROT13, Substitution)</li>
                  <li>Hash visualization with color patterns and avalanche effect demonstration</li>
                  <li>Entropy calculation for password strength analysis</li>
                  <li>Performance benchmarking and collision detection</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  Performance Optimizations
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Compiled with aggressive size optimization flags</li>
                  <li>Efficient string processing with minimal memory allocations</li>
                  <li>Optimized hash implementations for educational demonstrations</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  Size Constraints
                </h3>
                <p className="ml-4">
                  The entire WASM module is optimized to stay within GitHub
                  Pages hosting limits, with the compiled binary under 100KB
                  while maintaining full cryptographic functionality.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-blue-900 border border-blue-700 rounded-lg p-6">
            <h3 className="text-blue-100 font-semibold mb-2">
              Try These Features
            </h3>
            <ul className="text-blue-200 space-y-1">
              <li>• Test different hash algorithms with the same input to see output variations</li>
              <li>• Experiment with encryption keys and observe cipher transformations</li>
              <li>• Analyze the avalanche effect by changing just one character in the input</li>
              <li>• Calculate entropy to assess password strength and randomness</li>
              <li>• Run performance tests to compare WASM vs JavaScript implementations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
