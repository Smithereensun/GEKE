fn main() {
  println!("cargo:rerun-if-env-changed=GEKE_SCREENSHOT_OVERLAY_LEVEL");
  tauri_build::build();
}
