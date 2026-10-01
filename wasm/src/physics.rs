use wasm_bindgen::prelude::*;
use js_sys::Date;


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
