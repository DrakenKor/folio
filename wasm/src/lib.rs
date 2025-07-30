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

// Image Processing Module
// Optimized for size and performance with minimal dependencies

#[wasm_bindgen]
pub struct ImageProcessor {
    width: u32,
    height: u32,
}

#[wasm_bindgen]
impl ImageProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> ImageProcessor {
        ImageProcessor { width, height }
    }

    #[wasm_bindgen]
    pub fn get_width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen]
    pub fn get_height(&self) -> u32 {
        self.height
    }

    #[wasm_bindgen]
    pub fn set_dimensions(&mut self, width: u32, height: u32) {
        self.width = width;
        self.height = height;
    }
}

// Gaussian blur implementation
#[wasm_bindgen]
pub fn apply_blur(data: &mut [u8], width: u32, height: u32, radius: f32) {
    if radius <= 0.0 || data.len() != (width * height * 4) as usize {
        return;
    }

    let sigma = radius / 3.0;
    let kernel_size = (radius * 2.0).ceil() as i32 + 1;
    let half_kernel = kernel_size / 2;

    // Generate Gaussian kernel
    let mut kernel = vec![0.0f32; kernel_size as usize];
    let mut sum = 0.0f32;

    for i in 0..kernel_size {
        let x = (i - half_kernel) as f32;
        let value = (-x * x / (2.0 * sigma * sigma)).exp();
        kernel[i as usize] = value;
        sum += value;
    }

    // Normalize kernel
    for i in 0..kernel_size {
        kernel[i as usize] /= sum;
    }

    let mut temp = vec![0u8; data.len()];

    // Horizontal pass
    for y in 0..height {
        for x in 0..width {
            let mut r = 0.0f32;
            let mut g = 0.0f32;
            let mut b = 0.0f32;
            let mut a = 0.0f32;

            for k in 0..kernel_size {
                let sample_x = (x as i32 + k - half_kernel).max(0).min(width as i32 - 1) as u32;
                let idx = ((y * width + sample_x) * 4) as usize;
                let weight = kernel[k as usize];

                r += data[idx] as f32 * weight;
                g += data[idx + 1] as f32 * weight;
                b += data[idx + 2] as f32 * weight;
                a += data[idx + 3] as f32 * weight;
            }

            let idx = ((y * width + x) * 4) as usize;
            temp[idx] = r.round() as u8;
            temp[idx + 1] = g.round() as u8;
            temp[idx + 2] = b.round() as u8;
            temp[idx + 3] = a.round() as u8;
        }
    }

    // Vertical pass
    for y in 0..height {
        for x in 0..width {
            let mut r = 0.0f32;
            let mut g = 0.0f32;
            let mut b = 0.0f32;
            let mut a = 0.0f32;

            for k in 0..kernel_size {
                let sample_y = (y as i32 + k - half_kernel).max(0).min(height as i32 - 1) as u32;
                let idx = ((sample_y * width + x) * 4) as usize;
                let weight = kernel[k as usize];

                r += temp[idx] as f32 * weight;
                g += temp[idx + 1] as f32 * weight;
                b += temp[idx + 2] as f32 * weight;
                a += temp[idx + 3] as f32 * weight;
            }

            let idx = ((y * width + x) * 4) as usize;
            data[idx] = r.round() as u8;
            data[idx + 1] = g.round() as u8;
            data[idx + 2] = b.round() as u8;
            data[idx + 3] = a.round() as u8;
        }
    }
}

// Sobel edge detection
#[wasm_bindgen]
pub fn apply_edge_detection(data: &mut [u8], width: u32, height: u32) {
    if data.len() != (width * height * 4) as usize {
        return;
    }

    let mut temp = vec![0u8; data.len()];

    // Sobel kernels
    let sobel_x = [-1i32, 0, 1, -2, 0, 2, -1, 0, 1];
    let sobel_y = [-1i32, -2, -1, 0, 0, 0, 1, 2, 1];

    for y in 1..(height - 1) {
        for x in 1..(width - 1) {
            let mut gx = 0i32;
            let mut gy = 0i32;

            // Apply Sobel kernels
            for ky in 0..3 {
                for kx in 0..3 {
                    let px = x + kx - 1;
                    let py = y + ky - 1;
                    let idx = ((py * width + px) * 4) as usize;

                    // Convert to grayscale using luminance formula
                    let gray = (0.299 * data[idx] as f32 +
                               0.587 * data[idx + 1] as f32 +
                               0.114 * data[idx + 2] as f32) as i32;

                    let kernel_idx = (ky * 3 + kx) as usize;
                    gx += gray * sobel_x[kernel_idx];
                    gy += gray * sobel_y[kernel_idx];
                }
            }

            let magnitude = ((gx * gx + gy * gy) as f32).sqrt().min(255.0) as u8;
            let idx = ((y * width + x) * 4) as usize;

            temp[idx] = magnitude;
            temp[idx + 1] = magnitude;
            temp[idx + 2] = magnitude;
            temp[idx + 3] = data[idx + 3]; // Preserve alpha
        }
    }

    // Copy result back
    data.copy_from_slice(&temp);
}

// Color filters
#[wasm_bindgen]
pub fn apply_color_filter(data: &mut [u8], width: u32, height: u32, filter_type: &str) {
    if data.len() != (width * height * 4) as usize {
        return;
    }

    match filter_type {
        "sepia" => {
            for i in (0..data.len()).step_by(4) {
                let r = data[i] as f32;
                let g = data[i + 1] as f32;
                let b = data[i + 2] as f32;

                data[i] = (r * 0.393 + g * 0.769 + b * 0.189).min(255.0) as u8;
                data[i + 1] = (r * 0.349 + g * 0.686 + b * 0.168).min(255.0) as u8;
                data[i + 2] = (r * 0.272 + g * 0.534 + b * 0.131).min(255.0) as u8;
            }
        },
        "grayscale" => {
            for i in (0..data.len()).step_by(4) {
                let gray = (0.299 * data[i] as f32 +
                           0.587 * data[i + 1] as f32 +
                           0.114 * data[i + 2] as f32) as u8;
                data[i] = gray;
                data[i + 1] = gray;
                data[i + 2] = gray;
            }
        },
        "invert" => {
            for i in (0..data.len()).step_by(4) {
                data[i] = 255 - data[i];
                data[i + 1] = 255 - data[i + 1];
                data[i + 2] = 255 - data[i + 2];
            }
        },
        "red" => {
            for i in (0..data.len()).step_by(4) {
                data[i + 1] = 0;
                data[i + 2] = 0;
            }
        },
        "green" => {
            for i in (0..data.len()).step_by(4) {
                data[i] = 0;
                data[i + 2] = 0;
            }
        },
        "blue" => {
            for i in (0..data.len()).step_by(4) {
                data[i] = 0;
                data[i + 1] = 0;
            }
        },
        _ => {} // Unknown filter, do nothing
    }
}

// Brightness adjustment
#[wasm_bindgen]
pub fn adjust_brightness(data: &mut [u8], width: u32, height: u32, factor: f32) {
    if data.len() != (width * height * 4) as usize {
        return;
    }

    for i in (0..data.len()).step_by(4) {
        data[i] = (data[i] as f32 * factor).max(0.0).min(255.0) as u8;
        data[i + 1] = (data[i + 1] as f32 * factor).max(0.0).min(255.0) as u8;
        data[i + 2] = (data[i + 2] as f32 * factor).max(0.0).min(255.0) as u8;
    }
}

// Contrast adjustment
#[wasm_bindgen]
pub fn adjust_contrast(data: &mut [u8], width: u32, height: u32, factor: f32) {
    if data.len() != (width * height * 4) as usize {
        return;
    }

    let contrast_factor = (259.0 * (factor + 255.0)) / (255.0 * (259.0 - factor));

    for i in (0..data.len()).step_by(4) {
        data[i] = (contrast_factor * (data[i] as f32 - 128.0) + 128.0).max(0.0).min(255.0) as u8;
        data[i + 1] = (contrast_factor * (data[i + 1] as f32 - 128.0) + 128.0).max(0.0).min(255.0) as u8;
        data[i + 2] = (contrast_factor * (data[i + 2] as f32 - 128.0) + 128.0).max(0.0).min(255.0) as u8;
    }
}

// Sharpen filter
#[wasm_bindgen]
pub fn apply_sharpen(data: &mut [u8], width: u32, height: u32, strength: f32) {
    if data.len() != (width * height * 4) as usize || strength <= 0.0 {
        return;
    }

    let mut temp = vec![0u8; data.len()];

    // Sharpen kernel
    let kernel = [
        0.0, -strength, 0.0,
        -strength, 1.0 + 4.0 * strength, -strength,
        0.0, -strength, 0.0
    ];

    for y in 1..(height - 1) {
        for x in 1..(width - 1) {
            for c in 0..3 { // RGB channels only
                let mut sum = 0.0f32;

                for ky in 0..3 {
                    for kx in 0..3 {
                        let px = x + kx - 1;
                        let py = y + ky - 1;
                        let idx = ((py * width + px) * 4 + c) as usize;
                        let kernel_idx = (ky * 3 + kx) as usize;

                        sum += data[idx] as f32 * kernel[kernel_idx];
                    }
                }

                let idx = ((y * width + x) * 4 + c) as usize;
                temp[idx] = sum.max(0.0).min(255.0) as u8;
            }

            // Preserve alpha
            let idx = ((y * width + x) * 4 + 3) as usize;
            temp[idx] = data[idx];
        }
    }

    // Copy result back
    data.copy_from_slice(&temp);
}

// Physics Simulation Module
// Simple particle system with collision detection optimized for size

#[wasm_bindgen]
pub struct Particle {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    radius: f32,
    mass: f32,
    color: u32,
}

#[wasm_bindgen]
impl Particle {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32, vx: f32, vy: f32, radius: f32, mass: f32) -> Particle {
        Particle {
            x,
            y,
            vx,
            vy,
            radius,
            mass,
            color: 0xFFFFFF, // Default white
        }
    }

    #[wasm_bindgen(getter)]
    pub fn x(&self) -> f32 { self.x }

    #[wasm_bindgen(getter)]
    pub fn y(&self) -> f32 { self.y }

    #[wasm_bindgen(getter)]
    pub fn vx(&self) -> f32 { self.vx }

    #[wasm_bindgen(getter)]
    pub fn vy(&self) -> f32 { self.vy }

    #[wasm_bindgen(getter)]
    pub fn radius(&self) -> f32 { self.radius }

    #[wasm_bindgen(getter)]
    pub fn mass(&self) -> f32 { self.mass }

    #[wasm_bindgen(getter)]
    pub fn color(&self) -> u32 { self.color }

    #[wasm_bindgen(setter)]
    pub fn set_color(&mut self, color: u32) { self.color = color; }
}

#[wasm_bindgen]
pub struct ParticleSystem {
    particles: Vec<Particle>,
    width: f32,
    height: f32,
    gravity_x: f32,
    gravity_y: f32,
    damping: f32,
    restitution: f32,
    time_step: f32,
}

#[wasm_bindgen]
impl ParticleSystem {
    #[wasm_bindgen(constructor)]
    pub fn new(width: f32, height: f32) -> ParticleSystem {
        ParticleSystem {
            particles: Vec::new(),
            width,
            height,
            gravity_x: 0.0,
            gravity_y: 9.81 * 10.0, // Scaled for pixels
            damping: 0.99,
            restitution: 0.8,
            time_step: 1.0 / 60.0, // 60 FPS
        }
    }

    #[wasm_bindgen]
    pub fn add_particle(&mut self, x: f32, y: f32, vx: f32, vy: f32, radius: f32, mass: f32) -> usize {
        let particle = Particle::new(x, y, vx, vy, radius, mass);
        self.particles.push(particle);
        self.particles.len() - 1
    }

    #[wasm_bindgen]
    pub fn get_particle_count(&self) -> usize {
        self.particles.len()
    }

    #[wasm_bindgen]
    pub fn set_gravity(&mut self, x: f32, y: f32) {
        self.gravity_x = x;
        self.gravity_y = y;
    }

    #[wasm_bindgen]
    pub fn set_damping(&mut self, damping: f32) {
        self.damping = damping.max(0.0).min(1.0);
    }

    #[wasm_bindgen]
    pub fn set_restitution(&mut self, restitution: f32) {
        self.restitution = restitution.max(0.0).min(1.0);
    }

    #[wasm_bindgen]
    pub fn set_time_step(&mut self, dt: f32) {
        self.time_step = dt.max(0.001).min(0.1); // Clamp to reasonable values
    }

    #[wasm_bindgen]
    pub fn update(&mut self, dt: f32) {
        let actual_dt = if dt > 0.0 { dt } else { self.time_step };

        // Apply forces and integrate
        for particle in &mut self.particles {
            // Apply gravity
            particle.vx += self.gravity_x * actual_dt;
            particle.vy += self.gravity_y * actual_dt;

            // Apply damping
            particle.vx *= self.damping;
            particle.vy *= self.damping;

            // Integrate position
            particle.x += particle.vx * actual_dt;
            particle.y += particle.vy * actual_dt;
        }

        // Handle boundary collisions
        for particle in &mut self.particles {
            // Left and right boundaries
            if particle.x - particle.radius < 0.0 {
                particle.x = particle.radius;
                particle.vx = -particle.vx * self.restitution;
            } else if particle.x + particle.radius > self.width {
                particle.x = self.width - particle.radius;
                particle.vx = -particle.vx * self.restitution;
            }

            // Top and bottom boundaries
            if particle.y - particle.radius < 0.0 {
                particle.y = particle.radius;
                particle.vy = -particle.vy * self.restitution;
            } else if particle.y + particle.radius > self.height {
                particle.y = self.height - particle.radius;
                particle.vy = -particle.vy * self.restitution;
            }
        }

        // Handle particle-particle collisions
        self.handle_collisions();
    }

    fn handle_collisions(&mut self) {
        let particle_count = self.particles.len();

        for i in 0..particle_count {
            for j in (i + 1)..particle_count {
                let (p1_x, p1_y, p1_vx, p1_vy, p1_radius, p1_mass) = {
                    let p1 = &self.particles[i];
                    (p1.x, p1.y, p1.vx, p1.vy, p1.radius, p1.mass)
                };

                let (p2_x, p2_y, p2_vx, p2_vy, p2_radius, p2_mass) = {
                    let p2 = &self.particles[j];
                    (p2.x, p2.y, p2.vx, p2.vy, p2.radius, p2.mass)
                };

                let dx = p2_x - p1_x;
                let dy = p2_y - p1_y;
                let distance = (dx * dx + dy * dy).sqrt();
                let min_distance = p1_radius + p2_radius;

                if distance < min_distance && distance > 0.0 {
                    // Normalize collision vector
                    let nx = dx / distance;
                    let ny = dy / distance;

                    // Separate particles
                    let overlap = min_distance - distance;
                    let separation = overlap * 0.5;

                    // Update positions to separate particles
                    {
                        let p1 = &mut self.particles[i];
                        p1.x -= nx * separation;
                        p1.y -= ny * separation;
                    }
                    {
                        let p2 = &mut self.particles[j];
                        p2.x += nx * separation;
                        p2.y += ny * separation;
                    }

                    // Calculate relative velocity
                    let dvx = p2_vx - p1_vx;
                    let dvy = p2_vy - p1_vy;
                    let dvn = dvx * nx + dvy * ny;

                    // Do not resolve if velocities are separating
                    if dvn > 0.0 {
                        continue;
                    }

                    // Calculate collision impulse
                    let total_mass = p1_mass + p2_mass;
                    let impulse = 2.0 * dvn / total_mass * self.restitution;

                    // Apply impulse to velocities
                    {
                        let p1 = &mut self.particles[i];
                        p1.vx += impulse * p2_mass * nx;
                        p1.vy += impulse * p2_mass * ny;
                    }
                    {
                        let p2 = &mut self.particles[j];
                        p2.vx -= impulse * p1_mass * nx;
                        p2.vy -= impulse * p1_mass * ny;
                    }
                }
            }
        }
    }

    #[wasm_bindgen]
    pub fn get_positions(&self) -> Vec<f32> {
        let mut positions = Vec::with_capacity(self.particles.len() * 2);
        for particle in &self.particles {
            positions.push(particle.x);
            positions.push(particle.y);
        }
        positions
    }

    #[wasm_bindgen]
    pub fn get_velocities(&self) -> Vec<f32> {
        let mut velocities = Vec::with_capacity(self.particles.len() * 2);
        for particle in &self.particles {
            velocities.push(particle.vx);
            velocities.push(particle.vy);
        }
        velocities
    }

    #[wasm_bindgen]
    pub fn get_particle_data(&self) -> Vec<f32> {
        let mut data = Vec::with_capacity(self.particles.len() * 6);
        for particle in &self.particles {
            data.push(particle.x);
            data.push(particle.y);
            data.push(particle.vx);
            data.push(particle.vy);
            data.push(particle.radius);
            data.push(particle.mass);
        }
        data
    }

    #[wasm_bindgen]
    pub fn get_colors(&self) -> Vec<u32> {
        self.particles.iter().map(|p| p.color).collect()
    }

    #[wasm_bindgen]
    pub fn set_particle_position(&mut self, index: usize, x: f32, y: f32) {
        if index < self.particles.len() {
            self.particles[index].x = x;
            self.particles[index].y = y;
        }
    }

    #[wasm_bindgen]
    pub fn set_particle_velocity(&mut self, index: usize, vx: f32, vy: f32) {
        if index < self.particles.len() {
            self.particles[index].vx = vx;
            self.particles[index].vy = vy;
        }
    }

    #[wasm_bindgen]
    pub fn add_force_to_particle(&mut self, index: usize, fx: f32, fy: f32) {
        if index < self.particles.len() {
            let particle = &mut self.particles[index];
            let ax = fx / particle.mass;
            let ay = fy / particle.mass;
            particle.vx += ax * self.time_step;
            particle.vy += ay * self.time_step;
        }
    }

    #[wasm_bindgen]
    pub fn clear_particles(&mut self) {
        self.particles.clear();
    }

    #[wasm_bindgen]
    pub fn get_kinetic_energy(&self) -> f32 {
        let mut total_energy = 0.0;
        for particle in &self.particles {
            let speed_squared = particle.vx * particle.vx + particle.vy * particle.vy;
            total_energy += 0.5 * particle.mass * speed_squared;
        }
        total_energy
    }

    #[wasm_bindgen]
    pub fn get_bounds(&self) -> Vec<f32> {
        vec![0.0, 0.0, self.width, self.height]
    }

    #[wasm_bindgen]
    pub fn set_bounds(&mut self, width: f32, height: f32) {
        self.width = width.max(100.0); // Minimum bounds
        self.height = height.max(100.0);
    }
}

// Performance comparison functions for physics
#[wasm_bindgen]
pub fn physics_performance_test(particle_count: u32, iterations: u32) -> f64 {
    let start = Date::now();

    let mut system = ParticleSystem::new(800.0, 600.0);

    // Add particles
    for i in 0..particle_count {
        let x = (i as f32 % 20.0) * 40.0 + 50.0;
        let y = (i as f32 / 20.0) * 40.0 + 50.0;
        let vx = (i as f32 * 0.1).sin() * 50.0;
        let vy = (i as f32 * 0.1).cos() * 50.0;
        system.add_particle(x, y, vx, vy, 5.0, 1.0);
    }

    // Run simulation
    for _ in 0..iterations {
        system.update(1.0 / 60.0);
    }

    let end = Date::now();
    let duration = end - start;

    console_log!(
        "WASM physics test: {} particles, {} iterations in {:.2}ms",
        particle_count,
        iterations,
        duration
    );

    duration
}
