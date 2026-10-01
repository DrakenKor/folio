use wasm_bindgen::prelude::*;

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

// Shared-primitive filters. Their JavaScript twins live in src/lib/image-filters.ts
// and must keep the same loop order, edge policy and rounding.

fn round_u8(x: f64) -> u8 {
    (x + 0.5).floor().clamp(0.0, 255.0) as u8
}

fn clamp_index(v: i64, max: usize) -> usize {
    v.clamp(0, max as i64 - 1) as usize
}

fn valid_image(data: &[u8], width: u32, height: u32) -> bool {
    width > 0 && height > 0 && data.len() == (width as usize) * (height as usize) * 4
}

#[wasm_bindgen]
pub fn convolve(data: &mut [u8], width: u32, height: u32, kernel: &[f64], ksize: u32, divisor: f64, bias: f64) {
    let k = ksize as usize;
    if !valid_image(data, width, height) || k % 2 == 0 || kernel.len() != k * k {
        return;
    }
    let (w, h) = (width as usize, height as usize);
    let r = (k / 2) as i64;
    let d = if divisor == 0.0 { 1.0 } else { divisor };
    let src = data.to_vec();
    for y in 0..h {
        for x in 0..w {
            let o = (y * w + x) * 4;
            for c in 0..3 {
                let mut sum = 0.0f64;
                for ky in 0..k {
                    let sy = clamp_index(y as i64 + ky as i64 - r, h);
                    for kx in 0..k {
                        let sx = clamp_index(x as i64 + kx as i64 - r, w);
                        sum += kernel[ky * k + kx] * src[(sy * w + sx) * 4 + c] as f64;
                    }
                }
                data[o + c] = round_u8(sum / d + bias);
            }
        }
    }
}

#[wasm_bindgen]
pub fn color_matrix(data: &mut [u8], m: &[f64]) {
    if m.len() != 20 {
        return;
    }
    for px in data.chunks_exact_mut(4) {
        let (r, g, b, a) = (px[0] as f64, px[1] as f64, px[2] as f64, px[3] as f64);
        for c in 0..3 {
            let row = c * 5;
            px[c] = round_u8(m[row] * r + m[row + 1] * g + m[row + 2] * b + m[row + 3] * a + m[row + 4]);
        }
    }
}

#[wasm_bindgen]
pub fn gaussian_blur(data: &mut [u8], width: u32, height: u32, sigma: f64) {
    if !valid_image(data, width, height) || !sigma.is_finite() || sigma <= 0.0 {
        return;
    }
    let (w, h) = (width as usize, height as usize);
    let radius = ((3.0 * sigma).ceil() as i64).min(96);
    let mut weights: Vec<f64> = Vec::with_capacity((2 * radius + 1) as usize);
    let mut total = 0.0f64;
    for i in -radius..=radius {
        let v = (-((i * i) as f64) / (2.0 * sigma * sigma)).exp();
        weights.push(v);
        total += v;
    }
    for v in weights.iter_mut() {
        *v /= total;
    }
    // temp starts as a copy so alpha is carried through both passes
    let mut temp = data.to_vec();
    for y in 0..h {
        for x in 0..w {
            let o = (y * w + x) * 4;
            for c in 0..3 {
                let mut sum = 0.0f64;
                for i in -radius..=radius {
                    let sx = clamp_index(x as i64 + i, w);
                    sum += weights[(i + radius) as usize] * data[(y * w + sx) * 4 + c] as f64;
                }
                temp[o + c] = round_u8(sum);
            }
        }
    }
    for y in 0..h {
        for x in 0..w {
            let o = (y * w + x) * 4;
            for c in 0..3 {
                let mut sum = 0.0f64;
                for i in -radius..=radius {
                    let sy = clamp_index(y as i64 + i, h);
                    sum += weights[(i + radius) as usize] * temp[(sy * w + x) * 4 + c] as f64;
                }
                data[o + c] = round_u8(sum);
            }
        }
    }
}

#[wasm_bindgen]
pub fn sobel(data: &mut [u8], width: u32, height: u32) {
    if !valid_image(data, width, height) {
        return;
    }
    let (w, h) = (width as usize, height as usize);
    let src = data.to_vec();
    let luma = |x: i64, y: i64| -> f64 {
        let o = (clamp_index(y, h) * w + clamp_index(x, w)) * 4;
        0.299 * src[o] as f64 + 0.587 * src[o + 1] as f64 + 0.114 * src[o + 2] as f64
    };
    for y in 0..h as i64 {
        for x in 0..w as i64 {
            let (l00, l01, l02) = (luma(x - 1, y - 1), luma(x, y - 1), luma(x + 1, y - 1));
            let (l10, l12) = (luma(x - 1, y), luma(x + 1, y));
            let (l20, l21, l22) = (luma(x - 1, y + 1), luma(x, y + 1), luma(x + 1, y + 1));
            let gx = (l02 + 2.0 * l12 + l22) - (l00 + 2.0 * l10 + l20);
            let gy = (l20 + 2.0 * l21 + l22) - (l00 + 2.0 * l01 + l02);
            let v = round_u8((gx * gx + gy * gy).sqrt());
            let o = (y as usize * w + x as usize) * 4;
            data[o] = v;
            data[o + 1] = v;
            data[o + 2] = v;
        }
    }
}
