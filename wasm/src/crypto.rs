use wasm_bindgen::prelude::*;
use js_sys::Date;

// Cryptographic Demonstration Module
// Basic hash functions and simple encryption/decryption optimized for size

// Simple hash function implementations
#[wasm_bindgen]
pub fn simple_hash(input: &str) -> u32 {
    let mut hash = 5381u32;
    for byte in input.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(byte as u32);
    }
    hash
}

// FNV-1a hash implementation
#[wasm_bindgen]
pub fn fnv1a_hash(input: &str) -> u32 {
    let mut hash = 2166136261u32;
    for byte in input.bytes() {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(16777619);
    }
    hash
}

// Simple checksum
#[wasm_bindgen]
pub fn checksum(data: &[u8]) -> u32 {
    data.iter().map(|&b| b as u32).sum()
}

// CRC32 implementation (simplified)
#[wasm_bindgen]
pub fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xFFFFFFFFu32;

    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xEDB88320;
            } else {
                crc >>= 1;
            }
        }
    }

    !crc
}

// MD5-like hash (simplified demonstration version)
#[wasm_bindgen]
pub fn demo_md5_hash(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut hash = [0u32; 4];

    // Initialize hash values (MD5 constants)
    hash[0] = 0x67452301;
    hash[1] = 0xEFCDAB89;
    hash[2] = 0x98BADCFE;
    hash[3] = 0x10325476;

    // Simple mixing function (not actual MD5, just for demonstration)
    for (i, &byte) in bytes.iter().enumerate() {
        let idx = i % 4;
        hash[idx] = hash[idx].wrapping_add(byte as u32);
        hash[idx] = hash[idx].rotate_left(7);
        hash[idx] ^= hash[(idx + 1) % 4];
    }

    // Final mixing
    for i in 0..4 {
        hash[i] = hash[i].wrapping_mul(0x9E3779B9);
        hash[i] ^= hash[i] >> 16;
    }

    format!("{:08x}{:08x}{:08x}{:08x}", hash[0], hash[1], hash[2], hash[3])
}

// SHA-like hash (simplified demonstration version)
#[wasm_bindgen]
pub fn demo_sha_hash(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut hash = [0u32; 8];

    // Initialize hash values (SHA-256 initial constants)
    hash[0] = 0x6A09E667;
    hash[1] = 0xBB67AE85;
    hash[2] = 0x3C6EF372;
    hash[3] = 0xA54FF53A;
    hash[4] = 0x510E527F;
    hash[5] = 0x9B05688C;
    hash[6] = 0x1F83D9AB;
    hash[7] = 0x5BE0CD19;

    // Simple mixing (not actual SHA, just for demonstration)
    for (i, &byte) in bytes.iter().enumerate() {
        let idx = i % 8;
        hash[idx] = hash[idx].wrapping_add(byte as u32);
        hash[idx] = hash[idx].rotate_right(11);
        hash[idx] ^= hash[(idx + 1) % 8];
    }

    // Final compression
    for i in 0..8 {
        hash[i] = hash[i].wrapping_mul(0x9E3779B9);
        hash[i] ^= hash[i] >> 13;
        hash[i] = hash[i].wrapping_mul(0x85EBCA6B);
        hash[i] ^= hash[i] >> 16;
    }

    format!("{:08x}{:08x}{:08x}{:08x}{:08x}{:08x}{:08x}{:08x}",
            hash[0], hash[1], hash[2], hash[3], hash[4], hash[5], hash[6], hash[7])
}

// Caesar cipher implementation
#[wasm_bindgen]
pub fn caesar_encrypt(text: &str, shift: i32) -> String {
    let shift = ((shift % 26) + 26) % 26; // Normalize shift to 0-25

    text.chars()
        .map(|c| {
            if c.is_ascii_alphabetic() {
                let base = if c.is_ascii_lowercase() { b'a' } else { b'A' };
                let shifted = (c as u8 - base + shift as u8) % 26;
                (base + shifted) as char
            } else {
                c
            }
        })
        .collect()
}

#[wasm_bindgen]
pub fn caesar_decrypt(text: &str, shift: i32) -> String {
    caesar_encrypt(text, -shift)
}

// Simple XOR cipher
#[wasm_bindgen]
pub fn xor_encrypt(text: &str, key: &str) -> Vec<u8> {
    if key.is_empty() {
        return text.as_bytes().to_vec();
    }

    let key_bytes = key.as_bytes();
    text.as_bytes()
        .iter()
        .enumerate()
        .map(|(i, &byte)| byte ^ key_bytes[i % key_bytes.len()])
        .collect()
}

#[wasm_bindgen]
pub fn xor_decrypt(data: &[u8], key: &str) -> String {
    if key.is_empty() {
        return String::from_utf8_lossy(data).to_string();
    }

    let key_bytes = key.as_bytes();
    let decrypted: Vec<u8> = data
        .iter()
        .enumerate()
        .map(|(i, &byte)| byte ^ key_bytes[i % key_bytes.len()])
        .collect();

    String::from_utf8_lossy(&decrypted).to_string()
}

// ROT13 implementation
#[wasm_bindgen]
pub fn rot13(text: &str) -> String {
    caesar_encrypt(text, 13)
}

// Base64-like encoding (simplified)
#[wasm_bindgen]
pub fn simple_base64_encode(input: &str) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    let mut result = String::new();

    for chunk in bytes.chunks(3) {
        let mut buf = [0u8; 3];
        for (i, &byte) in chunk.iter().enumerate() {
            buf[i] = byte;
        }

        let b = ((buf[0] as u32) << 16) | ((buf[1] as u32) << 8) | (buf[2] as u32);

        result.push(CHARS[((b >> 18) & 63) as usize] as char);
        result.push(CHARS[((b >> 12) & 63) as usize] as char);
        result.push(if chunk.len() > 1 { CHARS[((b >> 6) & 63) as usize] as char } else { '=' });
        result.push(if chunk.len() > 2 { CHARS[(b & 63) as usize] as char } else { '=' });
    }

    result
}

// Simple substitution cipher
#[wasm_bindgen]
pub fn substitution_encrypt(text: &str, key: &str) -> String {
    if key.len() != 26 {
        return text.to_string(); // Invalid key
    }

    let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let key_upper = key.to_uppercase();

    text.chars()
        .map(|c| {
            if c.is_ascii_alphabetic() {
                let is_lower = c.is_ascii_lowercase();
                let c_upper = c.to_ascii_uppercase();

                if let Some(pos) = alphabet.find(c_upper) {
                    let encrypted = key_upper.chars().nth(pos).unwrap_or(c_upper);
                    if is_lower {
                        encrypted.to_ascii_lowercase()
                    } else {
                        encrypted
                    }
                } else {
                    c
                }
            } else {
                c
            }
        })
        .collect()
}

// Hash visualization data
#[wasm_bindgen]
pub fn hash_to_color(hash: u32) -> u32 {
    // Convert hash to RGB color
    let r = ((hash >> 16) & 0xFF) as u8;
    let g = ((hash >> 8) & 0xFF) as u8;
    let b = (hash & 0xFF) as u8;

    // Ensure minimum brightness
    let r = if r < 64 { r + 64 } else { r };
    let g = if g < 64 { g + 64 } else { g };
    let b = if b < 64 { b + 64 } else { b };

    ((r as u32) << 16) | ((g as u32) << 8) | (b as u32)
}

// Generate hash visualization pattern
#[wasm_bindgen]
pub fn hash_to_pattern(hash: u32, size: u32) -> Vec<u32> {
    let mut pattern = Vec::with_capacity((size * size) as usize);
    let mut current_hash = hash;

    for _ in 0..(size * size) {
        // Generate next hash value using simple LCG
        current_hash = current_hash.wrapping_mul(1664525).wrapping_add(1013904223);

        // Convert to color
        let color = hash_to_color(current_hash);
        pattern.push(color);
    }

    pattern
}

// Cryptographic performance test
#[wasm_bindgen]
pub fn crypto_performance_test(iterations: u32) -> f64 {
    let start = Date::now();

    let test_data = "The quick brown fox jumps over the lazy dog";

    for i in 0..iterations {
        let input = format!("{}{}", test_data, i);

        // Test various hash functions
        let _simple = simple_hash(&input);
        let _fnv = fnv1a_hash(&input);
        let _md5_demo = demo_md5_hash(&input);
        let _sha_demo = demo_sha_hash(&input);

        // Test encryption
        let _caesar = caesar_encrypt(&input, (i % 26) as i32);
        let _xor = xor_encrypt(&input, "key");
        let _rot13 = rot13(&input);
    }

    let end = Date::now();
    let duration = end - start;

    console_log!(
        "WASM crypto test: {} iterations in {:.2}ms ({:.0} ops/sec)",
        iterations,
        duration,
        (iterations as f64) / (duration / 1000.0)
    );

    duration
}

// Avalanche effect demonstration
#[wasm_bindgen]
pub fn demonstrate_avalanche_effect(input1: &str, input2: &str) -> Vec<u32> {
    let hash1 = demo_sha_hash(input1);
    let hash2 = demo_sha_hash(input2);

    let mut differences = Vec::new();
    let chars1: Vec<char> = hash1.chars().collect();
    let chars2: Vec<char> = hash2.chars().collect();

    for (i, (&c1, &c2)) in chars1.iter().zip(chars2.iter()).enumerate() {
        if c1 != c2 {
            differences.push(i as u32);
        }
    }

    differences
}

// Hash collision demonstration (intentionally simple for educational purposes)
#[wasm_bindgen]
pub fn find_simple_collision(target_hash: u32, max_attempts: u32) -> String {
    for i in 0..max_attempts {
        let test_string = format!("test{}", i);
        if simple_hash(&test_string) == target_hash {
            return test_string;
        }
    }
    "No collision found".to_string()
}

// Entropy calculation for passwords/text
#[wasm_bindgen]
pub fn calculate_entropy(text: &str) -> f64 {
    if text.is_empty() {
        return 0.0;
    }

    let mut char_counts = std::collections::HashMap::new();
    for c in text.chars() {
        *char_counts.entry(c).or_insert(0) += 1;
    }

    let length = text.len() as f64;
    let mut entropy = 0.0;

    for count in char_counts.values() {
        let probability = *count as f64 / length;
        entropy -= probability * probability.log2();
    }

    entropy
}

#[wasm_bindgen]
pub fn sha256(data: &[u8]) -> Vec<u8> {
    use sha2::{Digest, Sha256};
    Sha256::digest(data).to_vec()
}
