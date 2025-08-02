/**
 * @vitest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCryptoProcessor, WASMCryptoProcessor } from '../lib/wasm-crypto-processor';

// Mock the WASM module for testing
const mockWASMModule = {
  simple_hash: vi.fn((input: string) => 12345),
  fnv1a_hash: vi.fn((input: string) => 67890),
  demo_md5_hash: vi.fn((input: string) => 'abcdef1234567890abcdef1234567890'),
  demo_sha_hash: vi.fn((input: string) => 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'),
  crc32: vi.fn((data: Uint8Array) => 0x12345678),
  caesar_encrypt: vi.fn((text: string, shift: number) => 'Khoor, Zruog!'),
  caesar_decrypt: vi.fn((text: string, shift: number) => 'Hello, World!'),
  xor_encrypt: vi.fn((text: string, key: string) => new Uint8Array([1, 2, 3, 4])),
  xor_decrypt: vi.fn((data: Uint8Array, key: string) => 'Hello'),
  rot13: vi.fn((text: string) => 'Uryyb, Jbeyq!'),
  substitution_encrypt: vi.fn((text: string, key: string) => 'Svool, Dliow!'),
  simple_base64_encode: vi.fn((text: string) => 'SGVsbG8gV29ybGQ='),
  hash_to_color: vi.fn((hash: number) => 0xFF5733),
  hash_to_pattern: vi.fn((hash: number, size: number) => new Uint32Array(size * size).fill(0xFF5733)),
  demonstrate_avalanche_effect: vi.fn((input1: string, input2: string) => new Uint32Array([1, 3, 5, 7])),
  find_simple_collision: vi.fn((hash: number, attempts: number) => 'test123'),
  calculate_entropy: vi.fn((text: string) => 3.14159),
  crypto_performance_test: vi.fn((iterations: number) => 42.5)
};

// Mock the WASMModuleManager
vi.mock('../lib/wasm-module-manager', () => ({
  WASMModuleManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getModule: vi.fn().mockReturnValue(mockWASMModule),
    dispose: vi.fn()
  }))
}));

describe('WASMCryptoProcessor', () => {
  let cryptoProcessor: WASMCryptoProcessor;

  beforeEach(async () => {
    cryptoProcessor = getCryptoProcessor();
    await cryptoProcessor.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hash Functions', () => {
    test('should calculate simple hash', async () => {
      const result = await cryptoProcessor.simpleHash('test input');

      expect(result).toEqual({
        input: 'test input',
        output: 12345,
        algorithm: 'Simple Hash',
        timestamp: expect.any(Number),
        processingTime: expect.any(Number)
      });
      expect(mockWASMModule.simple_hash).toHaveBeenCalledWith('test input');
    });

    test('should calculate FNV-1a hash', async () => {
      const result = await cryptoProcessor.fnv1aHash('test input');

      expect(result).toEqual({
        input: 'test input',
        output: 67890,
        algorithm: 'FNV-1a Hash',
        timestamp: expect.any(Number),
        processingTime: expect.any(Number)
      });
      expect(mockWASMModule.fnv1a_hash).toHaveBeenCalledWith('test input');
    });

    test('should calculate demo MD5 hash', async () => {
      const result = await cryptoProcessor.demoMD5Hash('test input');

      expect(result).toEqual({
        input: 'test input',
        output: 'abcdef1234567890abcdef1234567890',
        algorithm: 'Demo MD5',
        timestamp: expect.any(Number),
        processingTime: expect.any(Number)
      });
      expect(mockWASMModule.demo_md5_hash).toHaveBeenCalledWith('test input');
    });

    test('should calculate demo SHA hash', async () => {
      const result = await cryptoProcessor.demoSHAHash('test input');

      expect(result).toEqual({
        input: 'test input',
        output: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        algorithm: 'Demo SHA',
        timestamp: expect.any(Number),
        processingTime: expect.any(Number)
      });
      expect(mockWASMModule.demo_sha_hash).toHaveBeenCalledWith('test input');
    });

    test('should calculate CRC32 hash', async () => {
      const result = await cryptoProcessor.crc32Hash('test input');

      expect(result).toEqual({
        input: 'test input',
        output: 0x12345678,
        algorithm: 'CRC32',
        timestamp: expect.any(Number),
        processingTime: expect.any(Number)
      });
      expect(mockWASMModule.crc32).toHaveBeenCalledWith(new Uint8Array([116, 101, 115, 116, 32, 105, 110, 112, 117, 116]));
    });
  });

  describe('Encryption Functions', () => {
    test('should encrypt with Caesar cipher', async () => {
      const result = await cryptoProcessor.caesarEncrypt('Hello, World!', 3);

      expect(result).toEqual({
        plaintext: 'Hello, World!',
        ciphertext: 'Khoor, Zruog!',
        algorithm: 'Caesar Cipher',
        key: '3',
        timestamp: expect.any(Number)
      });
      expect(mockWASMModule.caesar_encrypt).toHaveBeenCalledWith('Hello, World!', 3);
    });

    test('should decrypt with Caesar cipher', async () => {
      const result = await cryptoProcessor.caesarDecrypt('Khoor, Zruog!', 3);

      expect(result).toEqual({
        plaintext: 'Hello, World!',
        ciphertext: 'Khoor, Zruog!',
        algorithm: 'Caesar Cipher (Decrypt)',
        key: '3',
        timestamp: expect.any(Number)
      });
      expect(mockWASMModule.caesar_decrypt).toHaveBeenCalledWith('Khoor, Zruog!', 3);
    });

    test('should encrypt with XOR cipher', async () => {
      const result = await cryptoProcessor.xorEncrypt('Hello', 'key');

      expect(result).toEqual({
        plaintext: 'Hello',
        ciphertext: [1, 2, 3, 4],
        algorithm: 'XOR Cipher',
        key: 'key',
        timestamp: expect.any(Number)
      });
      expect(mockWASMModule.xor_encrypt).toHaveBeenCalledWith('Hello', 'key');
    });

    test('should decrypt with XOR cipher', async () => {
      const result = await cryptoProcessor.xorDecrypt([1, 2, 3, 4], 'key');

      expect(result).toEqual({
        plaintext: 'Hello',
        ciphertext: [1, 2, 3, 4],
        algorithm: 'XOR Cipher (Decrypt)',
        key: 'key',
        timestamp: expect.any(Number)
      });
      expect(mockWASMModule.xor_decrypt).toHaveBeenCalledWith(expect.any(Uint8Array), 'key');
    });

    test('should apply ROT13', async () => {
      const result = await cryptoProcessor.rot13('Hello, World!');

      expect(result).toEqual({
        plaintext: 'Hello, World!',
        ciphertext: 'Uryyb, Jbeyq!',
        algorithm: 'ROT13',
        timestamp: expect.any(Number)
      });
      expect(mockWASMModule.rot13).toHaveBeenCalledWith('Hello, World!');
    });

    test('should encrypt with substitution cipher', async () => {
      const result = await cryptoProcessor.substitutionEncrypt('Hello', 'ZYXWVUTSRQPONMLKJIHGFEDCBA');

      expect(result).toEqual({
        plaintext: 'Hello',
        ciphertext: 'Svool, Dliow!',
        algorithm: 'Substitution Cipher',
        key: 'ZYXWVUTSRQPONMLKJIHGFEDCBA',
        timestamp: expect.any(Number)
      });
      expect(mockWASMModule.substitution_encrypt).toHaveBeenCalledWith('Hello', 'ZYXWVUTSRQPONMLKJIHGFEDCBA');
    });

    test('should encode with Base64', async () => {
      const result = await cryptoProcessor.simpleBase64Encode('Hello World');

      expect(result).toEqual({
        plaintext: 'Hello World',
        ciphertext: 'SGVsbG8gV29ybGQ=',
        algorithm: 'Base64 Encoding',
        timestamp: expect.any(Number)
      });
      expect(mockWASMModule.simple_base64_encode).toHaveBeenCalledWith('Hello World');
    });
  });

  describe('Hash Visualization', () => {
    test('should generate hash visualization', async () => {
      const result = await cryptoProcessor.generateHashVisualization('test', 4);

      expect(result).toEqual({
        hash: 12345,
        color: 0xFF5733,
        pattern: expect.any(Array),
        size: 4
      });
      expect(result.pattern).toHaveLength(16); // 4x4 grid
      expect(mockWASMModule.simple_hash).toHaveBeenCalledWith('test');
      expect(mockWASMModule.hash_to_color).toHaveBeenCalledWith(12345);
      expect(mockWASMModule.hash_to_pattern).toHaveBeenCalledWith(12345, 4);
    });
  });

  describe('Cryptographic Analysis', () => {
    test('should demonstrate avalanche effect', async () => {
      const result = await cryptoProcessor.demonstrateAvalancheEffect('Hello', 'Hello!');

      expect(result).toEqual([1, 3, 5, 7]);
      expect(mockWASMModule.demonstrate_avalanche_effect).toHaveBeenCalledWith('Hello', 'Hello!');
    });

    test('should find simple collision', async () => {
      const result = await cryptoProcessor.findSimpleCollision(12345, 1000);

      expect(result).toBe('test123');
      expect(mockWASMModule.find_simple_collision).toHaveBeenCalledWith(12345, 1000);
    });

    test('should calculate entropy', async () => {
      const result = await cryptoProcessor.calculateEntropy('password123');

      expect(result).toBe(3.14159);
      expect(mockWASMModule.calculate_entropy).toHaveBeenCalledWith('password123');
    });
  });

  describe('Performance Testing', () => {
    test('should run performance test', async () => {
      const result = await cryptoProcessor.runPerformanceTest(500);

      expect(result).toBe(42.5);
      expect(mockWASMModule.crypto_performance_test).toHaveBeenCalledWith(500);
    });
  });

  describe('Utility Methods', () => {
    test('should convert hash to hex', () => {
      const result = cryptoProcessor.hashToHex(0x12345678);
      expect(result).toBe('12345678');
    });

    test('should convert color to hex', () => {
      const result = cryptoProcessor.colorToHex(0xFF5733);
      expect(result).toBe('#FF5733');
    });

    test('should format bytes', () => {
      const result = cryptoProcessor.formatBytes([255, 128, 64, 32]);
      expect(result).toBe('FF 80 40 20');
    });
  });

  describe('Error Handling', () => {
    test('should throw error when not initialized', async () => {
      const newProcessor = new WASMCryptoProcessor();

      await expect(newProcessor.simpleHash('test')).rejects.toThrow(
        'WASM Crypto Processor not initialized. Call initialize() first.'
      );
    });

    test('should handle WASM module errors', async () => {
      mockWASMModule.simple_hash.mockImplementationOnce(() => {
        throw new Error('WASM error');
      });

      await expect(cryptoProcessor.simpleHash('test')).rejects.toThrow('WASM error');
    });
  });
});

describe('getCryptoProcessor singleton', () => {
  test('should return the same instance', () => {
    const processor1 = getCryptoProcessor();
    const processor2 = getCryptoProcessor();

    expect(processor1).toBe(processor2);
  });
});
