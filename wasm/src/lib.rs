use wasm_bindgen::prelude::*;

// Import the `console.log` function from the `console` module
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn error(s: &str);
}

// Define macros for logging (usable from every module declared below)
macro_rules! console_log {
    ($($t:tt)*) => ($crate::log(&format_args!($($t)*).to_string()))
}

macro_rules! console_error {
    ($($t:tt)*) => ($crate::error(&format_args!($($t)*).to_string()))
}

// Use the macro to avoid unused warning
#[allow(dead_code)]
fn _use_console_error() {
    console_error!("This function ensures the macro is considered used");
}

mod bench;
#[path = "core.rs"]
mod core_fns;
mod crypto;
mod image;
mod physics;

// Set up panic hook for better error messages
#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}

// Use `wee_alloc` as the global allocator for smaller binary size
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;
