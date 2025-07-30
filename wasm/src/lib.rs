use wasm_bindgen::prelude::*;
use js_sys::*;
use web_sys::*;

// Import the `console.log` function from the `console` module
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn error(s: &str);
}

// Define macros for logging
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

macro_rules! console_error {
    ($($t:tt)*) => (error(&format_args!($($t)*).to_string()))
}

// Use the macro to avoid unused warning
#[allow(dead_code)]
fn _use_console_error() {
    console_error!("This function ensures the macro is considered used");
}

// Set up panic hook for better error messages
#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
    console_log!("Portfolio WASM module initialized");
}

// Use `wee_alloc` as the global allocator for smaller binary size
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// Core module information and utilities
#[wasm_bindgen]
pub struct WASMModule {
    initialized: bool,
    start_time: f64,
}

#[wasm_bindgen]
impl WASMModule {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WASMModule {
        WASMModule {
            initialized: true,
            start_time: Date::now(),
        }
    }

    #[wasm_bindgen]
    pub fn get_version(&self) -> String {
        "1.0.0".to_string()
    }

    #[wasm_bindgen]
    pub fn get_uptime(&self) -> f64 {
        Date::now() - self.start_time
    }

    #[wasm_bindgen]
    pub fn is_initialized(&self) -> bool {
        self.initialized
    }
}

// Export a simple test function to verify WASM is working
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! WASM is working perfectly.", name)
}

// Performance benchmarking functions
#[wasm_bindgen]
pub fn performance_test(iterations: u32) -> f64 {
    let start = Date::now();

    let mut _sum = 0.0;
    for i in 0..iterations {
        _sum += (i as f64).sin().cos().tan();
    }

    let end = Date::now();
    let duration = end - start;

    console_log!(
        "WASM performance test: {} iterations in {:.2}ms ({:.0} ops/sec)",
        iterations,
        duration,
        (iterations as f64) / (duration / 1000.0)
    );

    duration
}

// Mathematical operations for performance comparison
#[wasm_bindgen]
pub fn fibonacci(n: u32) -> u64 {
    if n <= 1 {
        return n as u64;
    }

    let mut a = 0u64;
    let mut b = 1u64;

    for _ in 2..=n {
        let temp = a + b;
        a = b;
        b = temp;
    }

    b
}

#[wasm_bindgen]
pub fn prime_sieve(limit: u32) -> Vec<u32> {
    if limit < 2 {
        return vec![];
    }

    let mut is_prime = vec![true; (limit + 1) as usize];
    is_prime[0] = false;
    is_prime[1] = false;

    let mut p = 2;
    while p * p <= limit {
        if is_prime[p as usize] {
            let mut i = p * p;
            while i <= limit {
                is_prime[i as usize] = false;
                i += p;
            }
        }
        p += 1;
    }

    let mut primes = Vec::new();
    for i in 2..=limit {
        if is_prime[i as usize] {
            primes.push(i);
        }
    }

    primes
}

// Matrix operations for linear algebra demonstrations
#[wasm_bindgen]
pub fn matrix_multiply(a: &[f64], b: &[f64], rows_a: usize, cols_a: usize, cols_b: usize) -> Vec<f64> {
    let mut result = vec![0.0; rows_a * cols_b];

    for i in 0..rows_a {
        for j in 0..cols_b {
            let mut sum = 0.0;
            for k in 0..cols_a {
                sum += a[i * cols_a + k] * b[k * cols_b + j];
            }
            result[i * cols_b + j] = sum;
        }
    }

    result
}

// Memory management utilities
#[wasm_bindgen]
pub fn get_memory_usage() -> u32 {
    // Return current memory pages * 64KB per page
    // This is a simplified approach since direct buffer access is complex
    (core::arch::wasm32::memory_size(0) * 65536) as u32
}

#[wasm_bindgen]
pub fn force_gc() {
    // This doesn't actually force GC in WASM, but we can log memory usage
    let memory_usage = get_memory_usage();
    console_log!("Current WASM memory usage: {} bytes", memory_usage);
}

// Utility functions for data processing
#[wasm_bindgen]
pub fn sum_array(arr: &[f64]) -> f64 {
    arr.iter().sum()
}

#[wasm_bindgen]
pub fn sort_array(arr: &mut [f64]) {
    arr.sort_by(|a, b| a.partial_cmp(b).unwrap());
}

#[wasm_bindgen]
pub fn find_max(arr: &[f64]) -> f64 {
    arr.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b))
}

#[wasm_bindgen]
pub fn find_min(arr: &[f64]) -> f64 {
    arr.iter().fold(f64::INFINITY, |a, &b| a.min(b))
}

// String processing utilities
#[wasm_bindgen]
pub fn reverse_string(s: &str) -> String {
    s.chars().rev().collect()
}

#[wasm_bindgen]
pub fn count_words(s: &str) -> u32 {
    s.split_whitespace().count() as u32
}

// Error handling demonstration
#[wasm_bindgen]
pub fn safe_divide(a: f64, b: f64) -> Result<f64, JsValue> {
    if b == 0.0 {
        Err(JsValue::from_str("Division by zero"))
    } else {
        Ok(a / b)
    }
}
