/* eslint-disable @next/next/no-assign-module-variable */
/**
 * WASM Cryptographic Processor
 * Provides TypeScript interface for cryptographic demonstrations
 */

export interface CryptoResult {
  input: string;
  output: string | number;
  algorithm: string;
  timestamp: number;
  processingTime: number;
}

export interface HashVisualization {
  hash: number;
  color: number;
  pattern: number[];
  size: number;
}

export interface EncryptionResult {
  plaintext: string;
  ciphertext: string | number[];
  algorithm: string;
  key?: string;
  timestamp: number;
}

export interface WASMCryptoModule {
  // Hash functions
  simple_hash(input: string): number;
  fnv1a_hash(input: string): number;
  demo_md5_hash(input: string): string;
  demo_sha_hash(input: string): string;
  crc32(data: Uint8Array): number;

  // Encryption functions
  caesar_encrypt(text: string, shift: number): string;
  caesar_decrypt(text: string, shift: number): string;
  xor_encrypt(text: string, key: string): Uint8Array;
  xor_decrypt(data: Uint8Array, key: string): string;
  rot13(text: string): string;
  substitution_encrypt(text: string, key: string): string;
  simple_base64_encode(text: string): string;

  // Hash visualization
  hash_to_color(hash: number): number;
  hash_to_pattern(hash: number, size: number): Uint32Array;

  // Analysis functions
  demonstrate_avalanche_effect(input1: string, input2: string): Uint32Array;
  find_simple_collision(targetHash: number, maxAttempts: number): string;
  calculate_entropy(text: string): number;
  crypto_performance_test(iterations: number): number;
}

class WASMCryptoProcessorLoader {
  private module: WASMCryptoModule | null = null;
  private loading: Promise<WASMCryptoModule> | null = null;

  async loadModule(): Promise<WASMCryptoModule> {
    if (this.module) {
      return this.module;
    }

    if (this.loading) {
      return this.loading;
    }

    this.loading = this.loadModuleInternal();
    return this.loading;
  }

  private async loadModuleInternal(): Promise<WASMCryptoModule> {
    // Client-side only
    if (typeof window === 'undefined') {
      throw new Error('WASM modules can only be loaded on the client side');
    }

    return new Promise((resolve, reject) => {
      // Create script element to load the WASM JS file
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import init, * as wasmModule from '/wasm/portfolio_wasm.js';

        (async () => {
          try {
            // Initialize the WASM module
            await init('/wasm/portfolio_wasm_bg.wasm');

            // Store the crypto module functions on window for access
            window.__wasmCryptoProcessor = {
              // Hash functions
              simple_hash: wasmModule.simple_hash,
              fnv1a_hash: wasmModule.fnv1a_hash,
              demo_md5_hash: wasmModule.demo_md5_hash,
              demo_sha_hash: wasmModule.demo_sha_hash,
              crc32: wasmModule.crc32,

              // Encryption functions
              caesar_encrypt: wasmModule.caesar_encrypt,
              caesar_decrypt: wasmModule.caesar_decrypt,
              xor_encrypt: wasmModule.xor_encrypt,
              xor_decrypt: wasmModule.xor_decrypt,
              rot13: wasmModule.rot13,
              substitution_encrypt: wasmModule.substitution_encrypt,
              simple_base64_encode: wasmModule.simple_base64_encode,

              // Hash visualization
              hash_to_color: wasmModule.hash_to_color,
              hash_to_pattern: wasmModule.hash_to_pattern,

              // Analysis functions
              demonstrate_avalanche_effect: wasmModule.demonstrate_avalanche_effect,
              find_simple_collision: wasmModule.find_simple_collision,
              calculate_entropy: wasmModule.calculate_entropy,
              crypto_performance_test: wasmModule.crypto_performance_test
            };

            // Dispatch custom event to signal completion
            window.dispatchEvent(new CustomEvent('wasmCryptoLoaded'));
          } catch (error) {
            window.dispatchEvent(new CustomEvent('wasmCryptoError', { detail: error }));
          }
        })();
      `;

      // Listen for completion events
      const handleWasmLoaded = () => {
        const wasmProcessor = (window as any).__wasmCryptoProcessor;
        if (wasmProcessor) {
          this.module = wasmProcessor;
          resolve(wasmProcessor);
        } else {
          reject(new Error('WASM crypto module loaded but functions not available'));
        }
        cleanup();
      };

      const handleWasmError = (event: CustomEvent) => {
        reject(new Error(`WASM crypto loading failed: ${event.detail}`));
        cleanup();
      };

      const cleanup = () => {
        window.removeEventListener('wasmCryptoLoaded', handleWasmLoaded);
        window.removeEventListener('wasmCryptoError', handleWasmError as EventListener);
        document.head.removeChild(script);
      };

      window.addEventListener('wasmCryptoLoaded', handleWasmLoaded);
      window.addEventListener('wasmCryptoError', handleWasmError as EventListener);

      // Add script to document
      document.head.appendChild(script);
    });
  }

  getModule(): WASMCryptoModule | null {
    return this.module;
  }
}

export class WASMCryptoProcessor {
  private wasmModule: WASMCryptoModule | null = null;
  private isInitialized = false;

  constructor() {}

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const loader = new WASMCryptoProcessorLoader();
      this.wasmModule = await loader.loadModule();
      this.isInitialized = true;

    } catch (error) {
      console.error('❌ Failed to initialize WASM Crypto Processor:', error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('WASM Crypto Processor not initialized. Call initialize() first.');
    }
  }

  private getModule(): WASMCryptoModule {
    this.ensureInitialized();
    if (!this.wasmModule) {
      throw new Error('WASM module not available');
    }
    return this.wasmModule;
  }

  // Hash Functions
  async simpleHash(input: string): Promise<CryptoResult> {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const module = this.getModule();
      const hash = module.simple_hash(input);
      const endTime = performance.now();

      return {
        input,
        output: hash,
        algorithm: 'Simple Hash',
        timestamp: Date.now(),
        processingTime: endTime - startTime
      };
    } catch (error) {
      console.error('Simple hash error:', error);
      throw error;
    }
  }

  async fnv1aHash(input: string): Promise<CryptoResult> {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const module = this.getModule();
      const hash = module.fnv1a_hash(input);
      const endTime = performance.now();

      return {
        input,
        output: hash,
        algorithm: 'FNV-1a Hash',
        timestamp: Date.now(),
        processingTime: endTime - startTime
      };
    } catch (error) {
      console.error('FNV-1a hash error:', error);
      throw error;
    }
  }

  async demoMD5Hash(input: string): Promise<CryptoResult> {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const module = this.getModule();
      const hash = module.demo_md5_hash(input);
      const endTime = performance.now();

      return {
        input,
        output: hash,
        algorithm: 'Demo MD5',
        timestamp: Date.now(),
        processingTime: endTime - startTime
      };
    } catch (error) {
      console.error('Demo MD5 hash error:', error);
      throw error;
    }
  }

  async demoSHAHash(input: string): Promise<CryptoResult> {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const module = this.getModule();
      const hash = module.demo_sha_hash(input);
      const endTime = performance.now();

      return {
        input,
        output: hash,
        algorithm: 'Demo SHA',
        timestamp: Date.now(),
        processingTime: endTime - startTime
      };
    } catch (error) {
      console.error('Demo SHA hash error:', error);
      throw error;
    }
  }

  async crc32Hash(input: string): Promise<CryptoResult> {
    this.ensureInitialized();
    const startTime = performance.now();

    try {
      const module = this.getModule();
      const data = new TextEncoder().encode(input);
      const hash = module.crc32(data);
      const endTime = performance.now();

      return {
        input,
        output: hash,
        algorithm: 'CRC32',
        timestamp: Date.now(),
        processingTime: endTime - startTime
      };
    } catch (error) {
      console.error('CRC32 hash error:', error);
      throw error;
    }
  }

  // Encryption Functions
  async caesarEncrypt(text: string, shift: number): Promise<EncryptionResult> {
    this.ensureInitialized();

    try {
      const module = this.getModule();
      const ciphertext = module.caesar_encrypt(text, shift);

      return {
        plaintext: text,
        ciphertext,
        algorithm: 'Caesar Cipher',
        key: shift.toString(),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Caesar encrypt error:', error);
      throw error;
    }
  }

  async caesarDecrypt(text: string, shift: number): Promise<EncryptionResult> {
    this.ensureInitialized();

    try {
      const module = this.getModule();
      const plaintext = module.caesar_decrypt(text, shift);

      return {
        plaintext,
        ciphertext: text,
        algorithm: 'Caesar Cipher (Decrypt)',
        key: shift.toString(),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Caesar decrypt error:', error);
      throw error;
    }
  }

  async xorEncrypt(text: string, key: string): Promise<EncryptionResult> {
    this.ensureInitialized();

    try {
      const module = this.getModule();
      const ciphertext = module.xor_encrypt(text, key);

      return {
        plaintext: text,
        ciphertext: Array.from(ciphertext),
        algorithm: 'XOR Cipher',
        key,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('XOR encrypt error:', error);
      throw error;
    }
  }

  async xorDecrypt(data: number[], key: string): Promise<EncryptionResult> {
    this.ensureInitialized();

    try {
      const module = this.getModule();
      const uint8Array = new Uint8Array(data);
      const plaintext = module.xor_decrypt(uint8Array, key);

      return {
        plaintext,
        ciphertext: data,
        algorithm: 'XOR Cipher (Decrypt)',
        key,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('XOR decrypt error:', error);
      throw error;
    }
  }

  async rot13(text: string): Promise<EncryptionResult> {
    this.ensureInitialized();

    try {
      const module = this.getModule();
      const result = module.rot13(text);

      return {
        plaintext: text,
        ciphertext: result,
        algorithm: 'ROT13',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('ROT13 error:', error);
      throw error;
    }
  }

  async substitutionEncrypt(text: string, key: string): Promise<EncryptionResult> {
    this.ensureInitialized();

    try {
      const module = this.getModule();
      const ciphertext = module.substitution_encrypt(text, key);

      return {
        plaintext: text,
        ciphertext,
        algorithm: 'Substitution Cipher',
        key,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Substitution encrypt error:', error);
      throw error;
    }
  }

  async simpleBase64Encode(text: string): Promise<EncryptionResult> {
    this.ensureInitialized();

    try {
      const module = this.getModule();
      const encoded = module.simple_base64_encode(text);

      return {
        plaintext: text,
        ciphertext: encoded,
        algorithm: 'Base64 Encoding',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Base64 encode error:', error);
      throw error;
    }
  }

  // Hash Visualization
  async generateHashVisualization(input: string, size: number = 8): Promise<HashVisualization> {
    this.ensureInitialized();

    try {
      const module = this.getModule();
      const hash = module.simple_hash(input);
      const color = module.hash_to_color(hash);
      const pattern = module.hash_to_pattern(hash, size);

      return {
        hash,
        color,
        pattern: Array.from(pattern),
        size
      };
    } catch (error) {
      console.error('Hash visualization error:', error);
      throw error;
    }
  }

  // Cryptographic Analysis
  async demonstrateAvalancheEffect(input1: string, input2: string): Promise<number[]> {
    this.ensureInitialized();

    try {
      const module = this.getModule();
      const differences = module.demonstrate_avalanche_effect(input1, input2);
      return Array.from(differences);
    } catch (error) {
      console.error('Avalanche effect demonstration error:', error);
      throw error;
    }
  }

  async findSimpleCollision(targetHash: number, maxAttempts: number = 10000): Promise<string> {
    this.ensureInitialized();

    try {
      const module = this.getModule();
      return module.find_simple_collision(targetHash, maxAttempts);
    } catch (error) {
      console.error('Collision finding error:', error);
      throw error;
    }
  }

  async calculateEntropy(text: string): Promise<number> {
    this.ensureInitialized();

    try {
      const module = this.getModule();
      return module.calculate_entropy(text);
    } catch (error) {
      console.error('Entropy calculation error:', error);
      throw error;
    }
  }

  // Performance Testing
  async runPerformanceTest(iterations: number = 1000): Promise<number> {
    this.ensureInitialized();

    try {
      const module = this.getModule();
      return module.crypto_performance_test(iterations);
    } catch (error) {
      console.error('Crypto performance test error:', error);
      throw error;
    }
  }

  // Utility Methods
  hashToHex(hash: number): string {
    return hash.toString(16).padStart(8, '0').toUpperCase();
  }

  colorToHex(color: number): string {
    return '#' + color.toString(16).padStart(6, '0').toUpperCase();
  }

  formatBytes(bytes: number[]): string {
    return bytes.map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
  }

  dispose(): void {
    this.wasmModule = null;
    this.isInitialized = false;
  }
}

// Singleton instance
const wasmCryptoProcessor = new WASMCryptoProcessorLoader();

// Convenience function
export async function loadWASMCryptoProcessor(): Promise<WASMCryptoModule> {
  return wasmCryptoProcessor.loadModule();
}

// Legacy singleton instance for backward compatibility
let cryptoProcessorInstance: WASMCryptoProcessor | null = null;

export function getCryptoProcessor(): WASMCryptoProcessor {
  if (!cryptoProcessorInstance) {
    cryptoProcessorInstance = new WASMCryptoProcessor();
  }
  return cryptoProcessorInstance;
}
