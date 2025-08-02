'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getCryptoProcessor, CryptoResult, EncryptionResult, HashVisualization } from '../lib/wasm-crypto-processor';

interface CryptoDemoState {
  isLoading: boolean;
  error: string | null;
  hashInput: string;
  encryptInput: string;
  encryptKey: string;
  caesarShift: number;
  selectedHashAlgorithm: string;
  selectedEncryptionAlgorithm: string;
  hashResults: CryptoResult[];
  encryptionResults: EncryptionResult[];
  hashVisualization: HashVisualization | null;
  avalancheInput1: string;
  avalancheInput2: string;
  avalancheDifferences: number[];
  entropyText: string;
  entropyValue: number;
  performanceResults: { iterations: number; duration: number } | null;
}

const HASH_ALGORITHMS = [
  { value: 'simple', label: 'Simple Hash' },
  { value: 'fnv1a', label: 'FNV-1a Hash' },
  { value: 'crc32', label: 'CRC32' },
  { value: 'md5', label: 'Demo MD5' },
  { value: 'sha', label: 'Demo SHA' }
];

const ENCRYPTION_ALGORITHMS = [
  { value: 'caesar', label: 'Caesar Cipher' },
  { value: 'xor', label: 'XOR Cipher' },
  { value: 'rot13', label: 'ROT13' },
  { value: 'substitution', label: 'Substitution Cipher' },
  { value: 'base64', label: 'Base64 Encoding' }
];

export default function CryptographicDemo() {
  const [state, setState] = useState<CryptoDemoState>({
    isLoading: true,
    error: null,
    hashInput: 'Hello, World!',
    encryptInput: 'Secret Message',
    encryptKey: 'mykey',
    caesarShift: 3,
    selectedHashAlgorithm: 'simple',
    selectedEncryptionAlgorithm: 'caesar',
    hashResults: [],
    encryptionResults: [],
    hashVisualization: null,
    avalancheInput1: 'Hello',
    avalancheInput2: 'Hello!',
    avalancheDifferences: [],
    entropyText: 'password123',
    entropyValue: 0,
    performanceResults: null
  });

  const cryptoProcessor = getCryptoProcessor();

  useEffect(() => {
    const initializeProcessor = async () => {
      try {
        await cryptoProcessor.initialize();
        setState(prev => ({ ...prev, isLoading: false }));
      } catch (error) {
        console.warn('WASM crypto loading failed, using fallback:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: `WASM crypto module not available. Some features may be limited.`
        }));
      }
    };

    initializeProcessor();
  }, [cryptoProcessor]);

  const updateState = useCallback((updates: Partial<CryptoDemoState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleHashCalculation = async () => {
    if (!state.hashInput.trim()) return;

    try {
      let result: CryptoResult;

      switch (state.selectedHashAlgorithm) {
        case 'simple':
          result = await cryptoProcessor.simpleHash(state.hashInput);
          break;
        case 'fnv1a':
          result = await cryptoProcessor.fnv1aHash(state.hashInput);
          break;
        case 'crc32':
          result = await cryptoProcessor.crc32Hash(state.hashInput);
          break;
        case 'md5':
          result = await cryptoProcessor.demoMD5Hash(state.hashInput);
          break;
        case 'sha':
          result = await cryptoProcessor.demoSHAHash(state.hashInput);
          break;
        default:
          result = await cryptoProcessor.simpleHash(state.hashInput);
      }

      updateState({
        hashResults: [result, ...state.hashResults.slice(0, 4)]
      });

      // Generate visualization for simple hash
      if (state.selectedHashAlgorithm === 'simple') {
        const visualization = await cryptoProcessor.generateHashVisualization(state.hashInput);
        updateState({ hashVisualization: visualization });
      }
    } catch (error) {
      updateState({ error: `Hash calculation failed: ${error}` });
    }
  };

  const handleEncryption = async () => {
    if (!state.encryptInput.trim()) return;

    try {
      let result: EncryptionResult;

      switch (state.selectedEncryptionAlgorithm) {
        case 'caesar':
          result = await cryptoProcessor.caesarEncrypt(state.encryptInput, state.caesarShift);
          break;
        case 'xor':
          result = await cryptoProcessor.xorEncrypt(state.encryptInput, state.encryptKey);
          break;
        case 'rot13':
          result = await cryptoProcessor.rot13(state.encryptInput);
          break;
        case 'substitution':
          const key = 'ZYXWVUTSRQPONMLKJIHGFEDCBA'; // Simple reverse alphabet
          result = await cryptoProcessor.substitutionEncrypt(state.encryptInput, key);
          break;
        case 'base64':
          result = await cryptoProcessor.simpleBase64Encode(state.encryptInput);
          break;
        default:
          result = await cryptoProcessor.caesarEncrypt(state.encryptInput, state.caesarShift);
      }

      updateState({
        encryptionResults: [result, ...state.encryptionResults.slice(0, 4)]
      });
    } catch (error) {
      updateState({ error: `Encryption failed: ${error}` });
    }
  };

  const handleDecryption = async () => {
    if (!state.encryptInput.trim()) return;

    try {
      let result: EncryptionResult;

      switch (state.selectedEncryptionAlgorithm) {
        case 'caesar':
          result = await cryptoProcessor.caesarDecrypt(state.encryptInput, state.caesarShift);
          break;
        case 'rot13':
          result = await cryptoProcessor.rot13(state.encryptInput); // ROT13 is its own inverse
          break;
        default:
          updateState({ error: 'Decryption not implemented for this algorithm' });
          return;
      }

      updateState({
        encryptionResults: [result, ...state.encryptionResults.slice(0, 4)]
      });
    } catch (error) {
      updateState({ error: `Decryption failed: ${error}` });
    }
  };

  const handleAvalancheDemo = async () => {
    try {
      const differences = await cryptoProcessor.demonstrateAvalancheEffect(
        state.avalancheInput1,
        state.avalancheInput2
      );
      updateState({ avalancheDifferences: differences });
    } catch (error) {
      updateState({ error: `Avalanche effect demonstration failed: ${error}` });
    }
  };

  const handleEntropyCalculation = async () => {
    try {
      const entropy = await cryptoProcessor.calculateEntropy(state.entropyText);
      updateState({ entropyValue: entropy });
    } catch (error) {
      updateState({ error: `Entropy calculation failed: ${error}` });
    }
  };

  const handlePerformanceTest = async () => {
    try {
      const duration = await cryptoProcessor.runPerformanceTest(1000);
      updateState({
        performanceResults: { iterations: 1000, duration }
      });
    } catch (error) {
      updateState({ error: `Performance test failed: ${error}` });
    }
  };

  const renderHashVisualization = () => {
    if (!state.hashVisualization) return null;

    const { pattern, size, color } = state.hashVisualization;
    const cellSize = 20;

    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Hash Visualization</h4>
        <div className="flex items-center gap-4">
          <div
            className="grid gap-1 p-2 bg-gray-50 rounded"
            style={{
              gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${size}, ${cellSize}px)`
            }}
          >
            {pattern.map((colorValue, index) => (
              <div
                key={index}
                className="rounded-sm"
                style={{
                  backgroundColor: cryptoProcessor.colorToHex(colorValue),
                  width: cellSize,
                  height: cellSize
                }}
              />
            ))}
          </div>
          <div className="text-sm text-gray-600">
            <div>Hash Color: <span style={{ color: cryptoProcessor.colorToHex(color) }}>
              {cryptoProcessor.colorToHex(color)}
            </span></div>
            <div>Pattern: {size}×{size} grid</div>
          </div>
        </div>
      </div>
    );
  };

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Initializing WASM Crypto Module...</span>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Error</h3>
        <p className="text-red-600 text-sm mt-1">{state.error}</p>
        <button
          onClick={() => updateState({ error: null })}
          className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Cryptographic Demonstrations
        </h1>
        <p className="text-gray-600">
          Interactive hash functions and encryption algorithms powered by WebAssembly
        </p>
      </div>

      {/* Hash Functions Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Hash Functions</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Input Text
                </label>
                <input
                  type="text"
                  value={state.hashInput}
                  onChange={(e) => updateState({ hashInput: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="Enter text to hash..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hash Algorithm
                </label>
                <select
                  value={state.selectedHashAlgorithm}
                  onChange={(e) => updateState({ selectedHashAlgorithm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  {HASH_ALGORITHMS.map(algo => (
                    <option key={algo.value} value={algo.value}>
                      {algo.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleHashCalculation}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Calculate Hash
              </button>
            </div>

            {renderHashVisualization()}
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">Recent Hash Results</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {state.hashResults.map((result, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm font-medium text-gray-700">
                    {result.algorithm}
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    Input: &quot;{result.input}&quot;
                  </div>
                  <div className="font-mono text-sm text-blue-600 break-all">
                    {typeof result.output === 'number'
                      ? cryptoProcessor.hashToHex(result.output)
                      : result.output
                    }
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Processed in {result.processingTime.toFixed(2)}ms
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Encryption Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Encryption & Encoding</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Input Text
                </label>
                <input
                  type="text"
                  value={state.encryptInput}
                  onChange={(e) => updateState({ encryptInput: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="Enter text to encrypt..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Algorithm
                </label>
                <select
                  value={state.selectedEncryptionAlgorithm}
                  onChange={(e) => updateState({ selectedEncryptionAlgorithm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  {ENCRYPTION_ALGORITHMS.map(algo => (
                    <option key={algo.value} value={algo.value}>
                      {algo.label}
                    </option>
                  ))}
                </select>
              </div>

              {state.selectedEncryptionAlgorithm === 'caesar' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Caesar Shift
                  </label>
                  <input
                    type="number"
                    value={state.caesarShift}
                    onChange={(e) => updateState({ caesarShift: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    min="1"
                    max="25"
                  />
                </div>
              )}

              {state.selectedEncryptionAlgorithm === 'xor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    XOR Key
                  </label>
                  <input
                    type="text"
                    value={state.encryptKey}
                    onChange={(e) => updateState({ encryptKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="Enter encryption key..."
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleEncryption}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                >
                  Encrypt
                </button>
                {(state.selectedEncryptionAlgorithm === 'caesar' || state.selectedEncryptionAlgorithm === 'rot13') && (
                  <button
                    onClick={handleDecryption}
                    className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 transition-colors"
                  >
                    Decrypt
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">Recent Encryption Results</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {state.encryptionResults.map((result, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm font-medium text-gray-700">
                    {result.algorithm}
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    Input: &quot;{result.plaintext}&quot;
                  </div>
                  <div className="font-mono text-sm text-green-600 break-all">
                    {Array.isArray(result.ciphertext)
                      ? cryptoProcessor.formatBytes(result.ciphertext)
                      : result.ciphertext
                    }
                  </div>
                  {result.key && (
                    <div className="text-xs text-gray-400 mt-1">
                      Key: {result.key}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Features Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Avalanche Effect */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Avalanche Effect</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Input 1
              </label>
              <input
                type="text"
                value={state.avalancheInput1}
                onChange={(e) => updateState({ avalancheInput1: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Input 2
              </label>
              <input
                type="text"
                value={state.avalancheInput2}
                onChange={(e) => updateState({ avalancheInput2: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <button
              onClick={handleAvalancheDemo}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors"
            >
              Compare Hashes
            </button>
            {state.avalancheDifferences.length > 0 && (
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Hash Differences: {state.avalancheDifferences.length} positions
                </div>
                <div className="text-xs text-gray-600">
                  Different at positions: {state.avalancheDifferences.join(', ')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Entropy Calculator */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Entropy Calculator</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Text to Analyze
              </label>
              <input
                type="text"
                value={state.entropyText}
                onChange={(e) => updateState({ entropyText: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="Enter text to calculate entropy..."
              />
            </div>
            <button
              onClick={handleEntropyCalculation}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Calculate Entropy
            </button>
            {state.entropyValue > 0 && (
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm font-medium text-gray-700">
                  Entropy: {state.entropyValue.toFixed(3)} bits per character
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {state.entropyValue < 2 ? 'Low entropy (predictable)' :
                   state.entropyValue < 4 ? 'Medium entropy' :
                   'High entropy (random)'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performance Test */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Performance Test</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={handlePerformanceTest}
            className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
          >
            Run Performance Test (1000 iterations)
          </button>
          {state.performanceResults && (
            <div className="text-sm text-gray-600">
              Completed {state.performanceResults.iterations} operations in{' '}
              {state.performanceResults.duration.toFixed(2)}ms
              ({Math.round(state.performanceResults.iterations / (state.performanceResults.duration / 1000))} ops/sec)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
