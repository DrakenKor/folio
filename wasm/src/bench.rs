use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn mandelbrot(width: u32, height: u32, max_iter: u32, out: &mut [u8]) {
    mandelbrot_rows(width, height, max_iter, 0, height, out)
}

#[wasm_bindgen]
pub fn mandelbrot_rows(width: u32, height: u32, max_iter: u32, y0: u32, y1: u32, out: &mut [u8]) {
    let w = width as usize;
    let h = height as usize;
    if w == 0 || h == 0 || out.len() != w * h {
        return;
    }
    let y1 = y1.min(height);
    for y in y0..y1 {
        let cy = -1.5 + 3.0 * (y as f64) / (height as f64);
        for x in 0..width {
            let cx = -2.2 + 3.0 * (x as f64) / (width as f64);
            let mut zx = 0.0f64;
            let mut zy = 0.0f64;
            let mut i = 0u32;
            while i < max_iter && zx * zx + zy * zy <= 4.0 {
                let t = zx * zx - zy * zy + cx;
                zy = 2.0 * zx * zy + cy;
                zx = t;
                i += 1;
            }
            out[y as usize * w + x as usize] = i.min(255) as u8;
        }
    }
}

#[wasm_bindgen]
pub fn nbody(positions: &mut [f64], velocities: &mut [f64], masses: &[f64], steps: u32, dt: f64) {
    let n = masses.len();
    if positions.len() != n * 2 || velocities.len() != n * 2 {
        return;
    }
    let mut acc = vec![0.0f64; n * 2];
    for _ in 0..steps {
        for i in 0..n {
            let mut ax = 0.0;
            let mut ay = 0.0;
            for j in 0..n {
                if j == i {
                    continue;
                }
                let dx = positions[2 * j] - positions[2 * i];
                let dy = positions[2 * j + 1] - positions[2 * i + 1];
                let d2 = dx * dx + dy * dy + 0.01;
                let inv = masses[j] / (d2 * d2.sqrt());
                ax += dx * inv;
                ay += dy * inv;
            }
            acc[2 * i] = ax;
            acc[2 * i + 1] = ay;
        }
        for i in 0..n {
            velocities[2 * i] += acc[2 * i] * dt;
            velocities[2 * i + 1] += acc[2 * i + 1] * dt;
            positions[2 * i] += velocities[2 * i] * dt;
            positions[2 * i + 1] += velocities[2 * i + 1] * dt;
        }
    }
}
