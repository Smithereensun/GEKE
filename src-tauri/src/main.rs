use base64::{engine::general_purpose, Engine as _};
use icns::{IconFamily, IconType};
use plist::Value;
use serde::{Deserialize, Serialize};
use std::{
  collections::{BTreeMap, BTreeSet},
  fs::{self, File},
  io::{BufReader, Cursor},
  path::{Path, PathBuf},
  process::{Command, Stdio},
  str::FromStr,
  sync::{
    mpsc, Arc, Mutex,
  },
  thread,
  time::{Duration, Instant},
};
use tauri::{
  WebviewUrl, WebviewWindowBuilder,
  image::Image,
  menu::{Menu, MenuItem, PredefinedMenuItem},
  tray::{TrayIconBuilder, TrayIconEvent},
  AppHandle, Emitter, Manager, State,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartExt};

#[cfg(target_os = "macos")]
use core_foundation::runloop::CFRunLoop;

#[cfg(target_os = "macos")]
use core_graphics::{
  display::CGShieldingWindowLevel,
  event::{
    CallbackResult, CGEvent, CGEventFlags, CGEventTap, CGEventTapLocation, CGEventTapOptions,
    CGEventTapPlacement, CGEventType, CGKeyCode, EventField, KeyCode,
  },
  event_source::{CGEventSource, CGEventSourceStateID},
};

#[cfg(target_os = "macos")]
use objc2::MainThreadMarker;

#[cfg(target_os = "macos")]
use objc2_app_kit::{NSScreen, NSScreenSaverWindowLevel, NSWindow, NSWindowCollectionBehavior, NSWindowStyleMask};

const APP_NAME: &str = "极刻 GEKE";
const DEFAULT_TOGGLE_SHORTCUT: &str = "Alt+Space";
const DEFAULT_SINGLE_WAKE_SHORTCUT: &str = "F18";
const DEFAULT_MODIFIER_WAKE_KEY: &str = "Alt";
const DEFAULT_SEARCH_ALL_SHORTCUT: &str = "F1";
const DEFAULT_SEARCH_APPS_SHORTCUT: &str = "F2";
const DEFAULT_SEARCH_FILES_SHORTCUT: &str = "F3";
const DEFAULT_RESCAN_SHORTCUT: &str = "CmdOrCtrl+R";
const DEFAULT_LANGUAGE: &str = "zh-CN";
const DEFAULT_APPEARANCE_MODE: &str = "system";
const DEFAULT_ANIMATION_MODE: &str = "smooth";
const DEFAULT_SCREENSHOT_SHORTCUT: &str = "CmdOrCtrl+Shift+S";
const DEFAULT_SCREENSHOT_FILE_NAME_FORMAT: &str = "极刻截图_yyyy-MM-dd_HH-mm-ss.png";
const LEGACY_SCREENSHOT_FILE_NAME_FORMAT: &str = "浮光截图_yyyy-MM-dd_HH-mm-ss.png";
const DEFAULT_SCREENSHOT_WATERMARK_TEXT: &str = "极刻 GEKE";
const SEARCH_LIMIT: usize = 40;

fn default_prefer_geke_shortcuts() -> bool {
  true
}

fn default_menu_icon_visible() -> bool {
  true
}

fn default_app_search_paths() -> Vec<String> {
  let home = dirs_next::home_dir().unwrap_or_else(|| PathBuf::from("/"));
  vec![
    PathBuf::from("/Applications"),
    home.join("Applications"),
    PathBuf::from("/System/Applications"),
    PathBuf::from("/System/Applications/Utilities"),
  ]
  .into_iter()
  .map(|path| path.to_string_lossy().to_string())
  .collect()
}

fn default_file_search_paths() -> Vec<String> {
  let home = dirs_next::home_dir().unwrap_or_else(|| PathBuf::from("/"));
  ["Desktop", "Documents", "Downloads", "Pictures", "Movies", "Music"]
    .iter()
    .map(|directory| home.join(directory).to_string_lossy().to_string())
    .collect()
}

#[derive(Default)]
struct LauncherState {
  apps: Vec<ApplicationEntry>,
  last_scan_at: Option<String>,
  settings: LauncherSettings,
  global_shortcuts_registered: bool,
  registered_shortcuts: BTreeSet<String>,
  priority_shortcuts: BTreeSet<String>,
}

#[derive(Clone)]
struct WakeRuntime {
  settings: Arc<Mutex<LauncherSettings>>,
  priority_shortcuts: Arc<Mutex<BTreeSet<String>>>,
}

#[derive(Default)]
struct ScreenshotSessionState {
  current: Option<ScreenshotSession>,
  starting: bool,
  window_ready: bool,
}

#[derive(Debug, Clone)]
struct ScreenshotSession {
  image_path: PathBuf,
  image_data_url: String,
  image_width: u32,
  image_height: u32,
  settings: ScreenshotPluginSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApplicationEntry {
  id: String,
  name: String,
  path: String,
  directory: String,
  icon_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LauncherPayload {
  query: String,
  results: Vec<ApplicationEntry>,
  total_count: usize,
  scanned_paths: Vec<String>,
  last_scan_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShortcutStatus {
  registered: bool,
  shortcut: String,
  message: String,
}

#[derive(Debug, Clone)]
struct ShortcutSyncResult {
  all_registered: bool,
  registered_shortcuts: BTreeSet<String>,
  priority_shortcuts: BTreeSet<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
#[serde(rename_all = "camelCase")]
struct LauncherSettings {
  toggle_shortcut: String,
  multi_wake_enabled: bool,
  single_wake_enabled: bool,
  single_wake_shortcut: String,
  search_all_shortcut: String,
  search_apps_shortcut: String,
  search_files_shortcut: String,
  rescan_shortcut: String,
  double_wake_enabled: bool,
  double_wake_modifier: String,
  long_press_wake_enabled: bool,
  long_press_wake_modifier: String,
  mouse_wake_enabled: bool,
  #[serde(default = "default_prefer_geke_shortcuts")]
  prefer_geke_shortcuts: bool,
  #[serde(default)]
  operation_sound_enabled: bool,
  #[serde(default = "default_menu_icon_visible")]
  menu_icon_visible: bool,
  #[serde(default)]
  launch_at_login: bool,
  #[serde(default = "default_app_search_paths")]
  app_search_paths: Vec<String>,
  #[serde(default = "default_file_search_paths")]
  file_search_paths: Vec<String>,
  language: String,
  appearance_mode: String,
  animation_mode: String,
  #[serde(default)]
  screenshot_plugin: ScreenshotPluginSettings,
}

impl Default for LauncherSettings {
  fn default() -> Self {
    Self {
      toggle_shortcut: DEFAULT_TOGGLE_SHORTCUT.to_string(),
      multi_wake_enabled: true,
      single_wake_enabled: false,
      single_wake_shortcut: DEFAULT_SINGLE_WAKE_SHORTCUT.to_string(),
      search_all_shortcut: DEFAULT_SEARCH_ALL_SHORTCUT.to_string(),
      search_apps_shortcut: DEFAULT_SEARCH_APPS_SHORTCUT.to_string(),
      search_files_shortcut: DEFAULT_SEARCH_FILES_SHORTCUT.to_string(),
      rescan_shortcut: DEFAULT_RESCAN_SHORTCUT.to_string(),
      double_wake_enabled: false,
      double_wake_modifier: DEFAULT_MODIFIER_WAKE_KEY.to_string(),
      long_press_wake_enabled: false,
      long_press_wake_modifier: DEFAULT_MODIFIER_WAKE_KEY.to_string(),
      mouse_wake_enabled: false,
      prefer_geke_shortcuts: default_prefer_geke_shortcuts(),
      operation_sound_enabled: false,
      menu_icon_visible: default_menu_icon_visible(),
      launch_at_login: false,
      app_search_paths: default_app_search_paths(),
      file_search_paths: default_file_search_paths(),
      language: DEFAULT_LANGUAGE.to_string(),
      appearance_mode: DEFAULT_APPEARANCE_MODE.to_string(),
      animation_mode: DEFAULT_ANIMATION_MODE.to_string(),
      screenshot_plugin: ScreenshotPluginSettings::default(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsPayload {
  toggle_shortcut: String,
  multi_wake_enabled: bool,
  single_wake_enabled: bool,
  single_wake_shortcut: String,
  search_all_shortcut: String,
  search_apps_shortcut: String,
  search_files_shortcut: String,
  rescan_shortcut: String,
  double_wake_enabled: bool,
  double_wake_modifier: String,
  long_press_wake_enabled: bool,
  long_press_wake_modifier: String,
  mouse_wake_enabled: bool,
  prefer_geke_shortcuts: bool,
  operation_sound_enabled: bool,
  menu_icon_visible: bool,
  launch_at_login: bool,
  app_search_paths: Vec<String>,
  invalid_app_search_paths: Vec<String>,
  file_search_paths: Vec<String>,
  invalid_file_search_paths: Vec<String>,
  language: String,
  appearance_mode: String,
  animation_mode: String,
  screenshot_plugin: ScreenshotPluginSettings,
  shortcut_status: ShortcutStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScreenshotSessionPayload {
  image_data_url: String,
  image_width: u32,
  image_height: u32,
  settings: ScreenshotPluginSettings,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScreenshotSelection {
  x: u32,
  y: u32,
  width: u32,
  height: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScreenshotCompletePayload {
  saved_path: Option<String>,
  copied: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
#[serde(rename_all = "camelCase")]
struct ScreenshotToolShortcut {
  shortcut: String,
  enabled: bool,
}

impl Default for ScreenshotToolShortcut {
  fn default() -> Self {
    Self {
      shortcut: String::new(),
      enabled: true,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
#[serde(rename_all = "camelCase")]
struct ScreenshotPluginSettings {
  installed: bool,
  enabled: bool,
  shortcut: String,
  default_tool: String,
  tool_shortcuts: BTreeMap<String, ScreenshotToolShortcut>,
  file_name_format: String,
  watermark_text: String,
  save_location: String,
  save_behavior: String,
  auto_open_folder: bool,
  auto_copy_path: bool,
  completion_preview: bool,
  auto_paste_after_capture: bool,
  double_click_finish: bool,
  confirm_before_close: bool,
  auto_focus_recent_area: bool,
  rounded_corners: bool,
  shadow: bool,
  pin_position: String,
  guides: bool,
}

impl Default for ScreenshotPluginSettings {
  fn default() -> Self {
    Self {
      installed: false,
      enabled: true,
      shortcut: DEFAULT_SCREENSHOT_SHORTCUT.to_string(),
      default_tool: String::new(),
      tool_shortcuts: default_screenshot_tool_shortcuts(),
      file_name_format: DEFAULT_SCREENSHOT_FILE_NAME_FORMAT.to_string(),
      watermark_text: DEFAULT_SCREENSHOT_WATERMARK_TEXT.to_string(),
      save_location: "~/Desktop".to_string(),
      save_behavior: "ask".to_string(),
      auto_open_folder: true,
      auto_copy_path: false,
      completion_preview: true,
      auto_paste_after_capture: false,
      double_click_finish: true,
      confirm_before_close: false,
      auto_focus_recent_area: false,
      rounded_corners: true,
      shadow: true,
      pin_position: "mouse".to_string(),
      guides: false,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileEntry {
  id: String,
  name: String,
  path: String,
  kind: String,
}

fn expand_user_path(path: &str) -> PathBuf {
  let trimmed = path.trim();
  if trimmed == "~" {
    return dirs_next::home_dir().unwrap_or_else(|| PathBuf::from(trimmed));
  }
  if let Some(rest) = trimmed.strip_prefix("~/") {
    return dirs_next::home_dir().unwrap_or_else(|| PathBuf::from("~")).join(rest);
  }
  PathBuf::from(trimmed)
}

fn normalize_search_paths(paths: &[String], defaults: Vec<String>) -> Vec<String> {
  let mut seen = BTreeSet::new();
  let normalized = paths
    .iter()
    .map(|path| path.trim())
    .filter(|path| !path.is_empty())
    .filter_map(|path| {
      let value = path.to_string();
      if seen.insert(value.clone()) {
        Some(value)
      } else {
        None
      }
    })
    .collect::<Vec<_>>();

  if normalized.is_empty() {
    defaults
  } else {
    normalized
  }
}

fn valid_search_directories(paths: &[String]) -> Vec<PathBuf> {
  paths
    .iter()
    .map(|path| expand_user_path(path))
    .filter(|path| path.is_dir())
    .collect()
}

fn invalid_search_paths(paths: &[String]) -> Vec<String> {
  paths
    .iter()
    .filter(|path| !expand_user_path(path).is_dir())
    .cloned()
    .collect()
}

fn first_existing_directory(paths: &[String]) -> PathBuf {
  paths
    .iter()
    .map(|path| expand_user_path(path))
    .find(|path| path.is_dir())
    .or_else(dirs_next::home_dir)
    .unwrap_or_else(|| PathBuf::from("/"))
}

fn now_iso() -> String {
  let output = Command::new("/bin/date")
    .arg("-u")
    .arg("+%Y-%m-%dT%H:%M:%SZ")
    .output();

  output
    .ok()
    .and_then(|result| String::from_utf8(result.stdout).ok())
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
    .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string())
}

fn settings_path() -> PathBuf {
  dirs_next::config_dir()
    .unwrap_or_else(|| dirs_next::home_dir().unwrap_or_else(|| PathBuf::from(".")))
    .join("极刻 GEKE")
    .join("settings.json")
}

fn default_screenshot_tool_shortcuts() -> BTreeMap<String, ScreenshotToolShortcut> {
  [
    ("move", "V"),
    ("note", "1"),
    ("step", "2"),
    ("rectangle", "3"),
    ("circle", "4"),
    ("arrow", "5"),
    ("text", "6"),
    ("highlight", "7"),
    ("mosaic", "8"),
    ("brush", "9"),
    ("watermark", "0"),
    ("ocr", "R"),
    ("translate", "T"),
    ("qr", "Q"),
    ("spotlightTranslate", "F"),
    ("record", "S"),
    ("delay", "D"),
    ("pin", "P"),
    ("copy", "Return"),
    ("download", "CmdOrCtrl+S"),
    ("cancel", "Escape"),
  ]
  .into_iter()
  .map(|(id, shortcut)| {
    (
      id.to_string(),
      ScreenshotToolShortcut {
        shortcut: shortcut.to_string(),
        enabled: true,
      },
    )
  })
  .collect()
}

fn normalize_screenshot_plugin(plugin: &mut ScreenshotPluginSettings) {
  let defaults = ScreenshotPluginSettings::default();
  if plugin.shortcut.trim().is_empty() {
    plugin.shortcut = defaults.shortcut;
  }
  plugin.default_tool.clear();
  for (id, shortcut) in defaults.tool_shortcuts {
    let state = plugin.tool_shortcuts.entry(id).or_insert_with(ScreenshotToolShortcut::default);
    if state.shortcut.trim().is_empty() {
      state.shortcut = shortcut.shortcut;
    }
  }
  if plugin.file_name_format.trim().is_empty() || plugin.file_name_format.trim() == LEGACY_SCREENSHOT_FILE_NAME_FORMAT {
    plugin.file_name_format = DEFAULT_SCREENSHOT_FILE_NAME_FORMAT.to_string();
  }
  if plugin.watermark_text.trim().is_empty() {
    plugin.watermark_text = DEFAULT_SCREENSHOT_WATERMARK_TEXT.to_string();
  }
  if plugin.save_location.trim().is_empty() {
    plugin.save_location = "~/Desktop".to_string();
  }
  if !matches!(plugin.save_behavior.as_str(), "ask" | "defaultFolder" | "manual") {
    plugin.save_behavior = "ask".to_string();
  }
  if !matches!(plugin.pin_position.as_str(), "mouse" | "topRight") {
    plugin.pin_position = "mouse".to_string();
  }
}

fn normalize_language(language: &str) -> String {
  match language {
    "zh-CN" | "en" => language.to_string(),
    _ => DEFAULT_LANGUAGE.to_string(),
  }
}

fn normalize_appearance_mode(mode: &str) -> String {
  match mode {
    "system" | "light" | "dark" => mode.to_string(),
    _ => DEFAULT_APPEARANCE_MODE.to_string(),
  }
}

fn normalize_animation_mode(mode: &str) -> String {
  match mode {
    "smooth" | "snappy" | "spring" | "none" => mode.to_string(),
    _ => DEFAULT_ANIMATION_MODE.to_string(),
  }
}

fn normalize_modifier_key(key: &str) -> String {
  match key {
    "Alt" | "Option" => "Alt".to_string(),
    "Command" | "Cmd" | "CmdOrCtrl" | "CommandOrControl" => "CmdOrCtrl".to_string(),
    "Control" | "Ctrl" => "Control".to_string(),
    "Shift" => "Shift".to_string(),
    _ => DEFAULT_MODIFIER_WAKE_KEY.to_string(),
  }
}

fn normalize_settings(settings: &mut LauncherSettings) {
  settings.language = normalize_language(&settings.language);
  settings.appearance_mode = normalize_appearance_mode(&settings.appearance_mode);
  settings.animation_mode = normalize_animation_mode(&settings.animation_mode);
  settings.double_wake_modifier = normalize_modifier_key(&settings.double_wake_modifier);
  settings.long_press_wake_modifier = normalize_modifier_key(&settings.long_press_wake_modifier);
  settings.single_wake_enabled = false;
  settings.single_wake_shortcut = DEFAULT_SINGLE_WAKE_SHORTCUT.to_string();
  settings.mouse_wake_enabled = false;
  if settings.search_all_shortcut.trim().is_empty() {
    settings.search_all_shortcut = DEFAULT_SEARCH_ALL_SHORTCUT.to_string();
  }
  if settings.search_apps_shortcut.trim().is_empty() {
    settings.search_apps_shortcut = DEFAULT_SEARCH_APPS_SHORTCUT.to_string();
  }
  if settings.search_files_shortcut.trim().is_empty() {
    settings.search_files_shortcut = DEFAULT_SEARCH_FILES_SHORTCUT.to_string();
  }
  if settings.rescan_shortcut.trim().is_empty() {
    settings.rescan_shortcut = DEFAULT_RESCAN_SHORTCUT.to_string();
  }
  settings.app_search_paths = normalize_search_paths(&settings.app_search_paths, default_app_search_paths());
  settings.file_search_paths = normalize_search_paths(&settings.file_search_paths, default_file_search_paths());
  if settings.toggle_shortcut.trim().is_empty() {
    settings.toggle_shortcut = DEFAULT_TOGGLE_SHORTCUT.to_string();
  }
  normalize_screenshot_plugin(&mut settings.screenshot_plugin);
}

fn enabled_wake_count(settings: &LauncherSettings) -> usize {
  [settings.multi_wake_enabled, settings.double_wake_enabled, settings.long_press_wake_enabled]
    .into_iter()
    .filter(|enabled| *enabled)
    .count()
}

fn load_settings() -> LauncherSettings {
  let path = settings_path();
  let Ok(content) = fs::read_to_string(path) else {
    return LauncherSettings::default();
  };
  let Ok(mut settings) = serde_json::from_str::<LauncherSettings>(&content) else {
    return LauncherSettings::default();
  };
  normalize_settings(&mut settings);
  if enabled_wake_count(&settings) == 0 {
    settings.multi_wake_enabled = true;
  }
  settings
}

fn save_settings(settings: &LauncherSettings) -> Result<(), String> {
  let path = settings_path();
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }
  let content = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
  fs::write(path, format!("{content}\n")).map_err(|error| error.to_string())
}

fn shortcut_status(settings: &LauncherSettings, registered_shortcuts: &BTreeSet<String>, priority_shortcuts: &BTreeSet<String>) -> ShortcutStatus {
  let registered = registered_shortcuts.contains(&settings.toggle_shortcut);
  let priority_active = priority_shortcuts.contains(&settings.toggle_shortcut);
  ShortcutStatus {
    registered: registered || priority_active,
    shortcut: settings.toggle_shortcut.clone(),
    message: if !settings.multi_wake_enabled {
      "多键唤起已关闭。".to_string()
    } else if registered {
      "Shortcut registered.".to_string()
    } else if priority_active {
      "Shortcut registered with GEKE priority.".to_string()
    } else if settings.prefer_geke_shortcuts {
      priority_permission_error()
    } else {
      "Shortcut is unavailable. It may already be used by macOS or another app.".to_string()
    },
  }
}

fn settings_payload(state: &LauncherState) -> SettingsPayload {
  SettingsPayload {
    toggle_shortcut: state.settings.toggle_shortcut.clone(),
    multi_wake_enabled: state.settings.multi_wake_enabled,
    single_wake_enabled: state.settings.single_wake_enabled,
    single_wake_shortcut: state.settings.single_wake_shortcut.clone(),
    search_all_shortcut: state.settings.search_all_shortcut.clone(),
    search_apps_shortcut: state.settings.search_apps_shortcut.clone(),
    search_files_shortcut: state.settings.search_files_shortcut.clone(),
    rescan_shortcut: state.settings.rescan_shortcut.clone(),
    double_wake_enabled: state.settings.double_wake_enabled,
    double_wake_modifier: state.settings.double_wake_modifier.clone(),
    long_press_wake_enabled: state.settings.long_press_wake_enabled,
    long_press_wake_modifier: state.settings.long_press_wake_modifier.clone(),
    mouse_wake_enabled: state.settings.mouse_wake_enabled,
    prefer_geke_shortcuts: state.settings.prefer_geke_shortcuts,
    operation_sound_enabled: state.settings.operation_sound_enabled,
    menu_icon_visible: state.settings.menu_icon_visible,
    launch_at_login: state.settings.launch_at_login,
    app_search_paths: state.settings.app_search_paths.clone(),
    invalid_app_search_paths: invalid_search_paths(&state.settings.app_search_paths),
    file_search_paths: state.settings.file_search_paths.clone(),
    invalid_file_search_paths: invalid_search_paths(&state.settings.file_search_paths),
    language: state.settings.language.clone(),
    appearance_mode: state.settings.appearance_mode.clone(),
    animation_mode: state.settings.animation_mode.clone(),
    screenshot_plugin: state.settings.screenshot_plugin.clone(),
    shortcut_status: shortcut_status(&state.settings, &state.registered_shortcuts, &state.priority_shortcuts),
  }
}

fn read_app_metadata(app_path: &Path) -> (String, Option<String>, Option<String>) {
  let fallback = app_path
    .file_stem()
    .and_then(|value| value.to_str())
    .unwrap_or("Application")
    .to_string();
  let plist_path = app_path.join("Contents").join("Info.plist");
  let Ok(value) = Value::from_file(plist_path) else {
    return (fallback, None, None);
  };
  let Some(dictionary) = value.as_dictionary() else {
    return (fallback, None, None);
  };

  let name = ["CFBundleDisplayName", "CFBundleName"]
    .iter()
    .find_map(|key| dictionary.get(*key)?.as_string())
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
    .unwrap_or(fallback);

  let bundle_identifier = dictionary
    .get("CFBundleIdentifier")
    .and_then(|value| value.as_string())
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty());

  let icon_file = dictionary
    .get("CFBundleIconFile")
    .and_then(|value| value.as_string())
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty());

  (name, bundle_identifier, icon_file)
}

fn app_identity(path: &Path, bundle_identifier: Option<&str>) -> String {
  if let Some(identifier) = bundle_identifier {
    return format!("bundle:{identifier}");
  }

  fs::canonicalize(path)
    .unwrap_or_else(|_| path.to_path_buf())
    .to_string_lossy()
    .to_string()
}

fn app_icon_path(app_path: &Path, icon_file: Option<&str>) -> Option<PathBuf> {
  let resources = app_path.join("Contents").join("Resources");
  if let Some(icon_file) = icon_file {
    let candidate = resources.join(icon_file);
    if candidate.is_file() {
      return Some(candidate);
    }
    let candidate = resources.join(format!("{icon_file}.icns"));
    if candidate.is_file() {
      return Some(candidate);
    }
  }

  ["AppIcon.icns", "app.icns", "icon.icns", "Icon.icns"]
    .iter()
    .map(|name| resources.join(name))
    .find(|path| path.is_file())
    .or_else(|| {
      fs::read_dir(resources)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .find(|path| path.extension().and_then(|value| value.to_str()) == Some("icns"))
    })
}

fn app_icon_data_url(app_path: &Path, icon_file: Option<&str>) -> Option<String> {
  let icon_path = app_icon_path(app_path, icon_file)?;
  let file = BufReader::new(File::open(icon_path).ok()?);
  let family = IconFamily::read(file).ok()?;
  let preferred_types = [
    IconType::RGBA32_64x64,
    IconType::RGBA32_32x32_2x,
    IconType::RGBA32_128x128,
    IconType::RGB24_128x128,
    IconType::RGBA32_256x256,
    IconType::RGB24_48x48,
    IconType::RGBA32_32x32,
  ];
  let icon_type = preferred_types
    .iter()
    .copied()
    .find(|icon_type| family.has_icon_with_type(*icon_type))
    .or_else(|| {
      family
        .available_icons()
        .iter()
        .copied()
        .filter(|icon_type| !icon_type.is_mask())
        .max_by_key(|icon_type| icon_type.pixel_width() * icon_type.pixel_height())
    })?;
  let image = family.get_icon_with_type(icon_type).ok()?;
  let mut png_bytes = Vec::new();
  image.write_png(Cursor::new(&mut png_bytes)).ok()?;
  Some(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(png_bytes)))
}

fn collect_apps_in_directory(root: &Path, source: &Path, apps: &mut BTreeMap<String, ApplicationEntry>) {
  let Ok(entries) = fs::read_dir(root) else {
    return;
  };

  for entry in entries.flatten() {
    let path = entry.path();
    let Ok(file_type) = entry.file_type() else {
      continue;
    };
    if !file_type.is_dir() {
      continue;
    }
    if path.file_name().and_then(|value| value.to_str()).is_some_and(|name| name.starts_with('.')) {
      continue;
    }

    if path.extension().and_then(|value| value.to_str()) == Some("app") {
      let (name, bundle_identifier, icon_file) = read_app_metadata(&path);
      let id = app_identity(&path, bundle_identifier.as_deref());
      let icon_data_url = app_icon_data_url(&path, icon_file.as_deref());
      apps.insert(
        id.clone(),
        ApplicationEntry {
          id,
          name,
          path: path.to_string_lossy().to_string(),
          directory: source.to_string_lossy().to_string(),
          icon_data_url,
        },
      );
    } else {
      collect_apps_in_directory(&path, source, apps);
    }
  }
}

fn scan_applications(directories: &[PathBuf]) -> Vec<ApplicationEntry> {
  let mut apps = BTreeMap::new();
  for directory in directories {
    collect_apps_in_directory(&directory, &directory, &mut apps);
  }
  let mut entries: Vec<_> = apps.into_values().collect();
  entries.sort_by(|left, right| {
    left
      .name
      .to_lowercase()
      .cmp(&right.name.to_lowercase())
      .then(left.path.cmp(&right.path))
  });
  entries
}

fn app_score(entry: &ApplicationEntry, query: &str) -> i32 {
  let query = query.trim().to_lowercase();
  if query.is_empty() {
    return 1;
  }
  let name = entry.name.to_lowercase();
  let path = entry.path.to_lowercase();
  if name == query {
    1200
  } else if name.starts_with(&query) {
    1000
  } else if name.contains(&query) {
    760
  } else if path.contains(&query) {
    320
  } else {
    0
  }
}

fn create_payload(query: &str, state: &LauncherState) -> LauncherPayload {
  let trimmed_query = query.trim();
  let mut results = state.apps.clone();
  let total_count = if trimmed_query.is_empty() {
    state.apps.len()
  } else {
    results.sort_by(|left, right| app_score(right, query).cmp(&app_score(left, query)).then(left.name.cmp(&right.name)));
    results.retain(|entry| app_score(entry, query) > 0);
    let matching_count = results.len();
    results.truncate(SEARCH_LIMIT);
    matching_count
  };

  LauncherPayload {
    query: query.to_string(),
    results,
    total_count,
    scanned_paths: state.settings.app_search_paths.clone(),
    last_scan_at: state.last_scan_at.clone(),
  }
}

fn show_launcher(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    restore_window_visibility_for_capture(&window);
    let _ = window.show();
    let _ = window.set_focus();
    let _ = window.emit("launcher:window-visible", ());
  }
}

fn hide_launcher_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.hide();
  }
}

fn toggle_launcher(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    if window.is_visible().unwrap_or(false) {
      let _ = window.hide();
    } else {
      restore_window_visibility_for_capture(&window);
      let _ = window.show();
      let _ = window.set_focus();
      let _ = window.emit("launcher:window-visible", ());
    }
  }
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
  fn CGPreflightListenEventAccess() -> bool;
  fn CGRequestListenEventAccess() -> bool;
  fn CGPreflightScreenCaptureAccess() -> bool;
  fn CGRequestScreenCaptureAccess() -> bool;
}

#[cfg(target_os = "macos")]
fn current_event_flags() -> Option<CGEventFlags> {
  let source = CGEventSource::new(CGEventSourceStateID::CombinedSessionState).ok()?;
  let event = CGEvent::new(source).ok()?;
  Some(event.get_flags())
}

#[cfg(target_os = "macos")]
fn modifier_is_pressed(flags: CGEventFlags, modifier: &str) -> bool {
  match normalize_modifier_key(modifier).as_str() {
    "Alt" => flags.contains(CGEventFlags::CGEventFlagAlternate),
    "CmdOrCtrl" => flags.contains(CGEventFlags::CGEventFlagCommand),
    "Control" => flags.contains(CGEventFlags::CGEventFlagControl),
    "Shift" => flags.contains(CGEventFlags::CGEventFlagShift),
    _ => false,
  }
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, Copy)]
struct ShortcutModifiers {
  alt: bool,
  command: bool,
  control: bool,
  shift: bool,
}

#[cfg(target_os = "macos")]
impl ShortcutModifiers {
  fn empty() -> Self {
    Self {
      alt: false,
      command: false,
      control: false,
      shift: false,
    }
  }
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, Copy)]
struct KeyCombo {
  modifiers: ShortcutModifiers,
  key_code: Option<CGKeyCode>,
}

#[cfg(target_os = "macos")]
fn shortcut_key_code(part: &str) -> Option<CGKeyCode> {
  match part {
    "A" => Some(KeyCode::ANSI_A),
    "B" => Some(KeyCode::ANSI_B),
    "C" => Some(KeyCode::ANSI_C),
    "D" => Some(KeyCode::ANSI_D),
    "E" => Some(KeyCode::ANSI_E),
    "F" => Some(KeyCode::ANSI_F),
    "G" => Some(KeyCode::ANSI_G),
    "H" => Some(KeyCode::ANSI_H),
    "I" => Some(KeyCode::ANSI_I),
    "J" => Some(KeyCode::ANSI_J),
    "K" => Some(KeyCode::ANSI_K),
    "L" => Some(KeyCode::ANSI_L),
    "M" => Some(KeyCode::ANSI_M),
    "N" => Some(KeyCode::ANSI_N),
    "O" => Some(KeyCode::ANSI_O),
    "P" => Some(KeyCode::ANSI_P),
    "Q" => Some(KeyCode::ANSI_Q),
    "R" => Some(KeyCode::ANSI_R),
    "S" => Some(KeyCode::ANSI_S),
    "T" => Some(KeyCode::ANSI_T),
    "U" => Some(KeyCode::ANSI_U),
    "V" => Some(KeyCode::ANSI_V),
    "W" => Some(KeyCode::ANSI_W),
    "X" => Some(KeyCode::ANSI_X),
    "Y" => Some(KeyCode::ANSI_Y),
    "Z" => Some(KeyCode::ANSI_Z),
    "0" => Some(KeyCode::ANSI_0),
    "1" => Some(KeyCode::ANSI_1),
    "2" => Some(KeyCode::ANSI_2),
    "3" => Some(KeyCode::ANSI_3),
    "4" => Some(KeyCode::ANSI_4),
    "5" => Some(KeyCode::ANSI_5),
    "6" => Some(KeyCode::ANSI_6),
    "7" => Some(KeyCode::ANSI_7),
    "8" => Some(KeyCode::ANSI_8),
    "9" => Some(KeyCode::ANSI_9),
    "Space" => Some(KeyCode::SPACE),
    "Return" | "Enter" => Some(KeyCode::RETURN),
    "Tab" => Some(KeyCode::TAB),
    "Escape" => Some(KeyCode::ESCAPE),
    "Backspace" => Some(KeyCode::DELETE),
    "Delete" => Some(KeyCode::FORWARD_DELETE),
    "Up" => Some(KeyCode::UP_ARROW),
    "Down" => Some(KeyCode::DOWN_ARROW),
    "Left" => Some(KeyCode::LEFT_ARROW),
    "Right" => Some(KeyCode::RIGHT_ARROW),
    "Home" => Some(KeyCode::HOME),
    "End" => Some(KeyCode::END),
    "PageUp" => Some(KeyCode::PAGE_UP),
    "PageDown" => Some(KeyCode::PAGE_DOWN),
    "F1" => Some(KeyCode::F1),
    "F2" => Some(KeyCode::F2),
    "F3" => Some(KeyCode::F3),
    "F4" => Some(KeyCode::F4),
    "F5" => Some(KeyCode::F5),
    "F6" => Some(KeyCode::F6),
    "F7" => Some(KeyCode::F7),
    "F8" => Some(KeyCode::F8),
    "F9" => Some(KeyCode::F9),
    "F10" => Some(KeyCode::F10),
    "F11" => Some(KeyCode::F11),
    "F12" => Some(KeyCode::F12),
    "F13" => Some(KeyCode::F13),
    "F14" => Some(KeyCode::F14),
    "F15" => Some(KeyCode::F15),
    "F16" => Some(KeyCode::F16),
    "F17" => Some(KeyCode::F17),
    "F18" => Some(KeyCode::F18),
    "F19" => Some(KeyCode::F19),
    "F20" => Some(KeyCode::F20),
    _ => None,
  }
}

#[cfg(target_os = "macos")]
fn shortcut_to_key_combo(shortcut: &str) -> Option<KeyCombo> {
  let mut modifiers = ShortcutModifiers::empty();
  let mut key_code = None;

  for raw_part in shortcut.split('+') {
    let part = raw_part.trim();
    match part {
      "Alt" | "Option" => modifiers.alt = true,
      "CmdOrCtrl" | "CommandOrControl" | "Command" | "Cmd" => modifiers.command = true,
      "Control" | "Ctrl" => modifiers.control = true,
      "Shift" => modifiers.shift = true,
      "" => {}
      value => {
        if key_code.is_some() {
          return None;
        }
        key_code = shortcut_key_code(value);
        key_code?;
      }
    }
  }

  if key_code.is_none() && !(modifiers.alt || modifiers.command || modifiers.control || modifiers.shift) {
    return None;
  }

  Some(KeyCombo { modifiers, key_code })
}

#[cfg(target_os = "macos")]
fn event_flags_match(flags: CGEventFlags, modifiers: ShortcutModifiers) -> bool {
  flags.contains(CGEventFlags::CGEventFlagAlternate) == modifiers.alt
    && flags.contains(CGEventFlags::CGEventFlagCommand) == modifiers.command
    && flags.contains(CGEventFlags::CGEventFlagControl) == modifiers.control
    && flags.contains(CGEventFlags::CGEventFlagShift) == modifiers.shift
}

#[cfg(target_os = "macos")]
fn event_matches_shortcut(event_type: CGEventType, event: &CGEvent, shortcut: &str) -> bool {
  let Some(combo) = shortcut_to_key_combo(shortcut) else {
    return false;
  };
  let flags = event.get_flags();
  if !event_flags_match(flags, combo.modifiers) {
    return false;
  }

  match combo.key_code {
    Some(key_code) => {
      matches!(event_type, CGEventType::KeyDown)
        && event.get_integer_value_field(EventField::KEYBOARD_EVENT_KEYCODE) as CGKeyCode == key_code
    }
    None => matches!(event_type, CGEventType::FlagsChanged),
  }
}

#[cfg(target_os = "macos")]
fn can_create_priority_event_tap() -> bool {
  unsafe {
    if !CGPreflightListenEventAccess() {
      return false;
    }
  }

  CGEventTap::new(
    CGEventTapLocation::HID,
    CGEventTapPlacement::HeadInsertEventTap,
    CGEventTapOptions::Default,
    vec![CGEventType::KeyDown, CGEventType::FlagsChanged],
    |_proxy, _event_type, _event| CallbackResult::Keep,
  )
  .is_ok()
}

#[cfg(target_os = "macos")]
fn request_priority_shortcut_access() -> bool {
  if can_create_priority_event_tap() {
    return true;
  }

  unsafe {
    let _ = CGRequestListenEventAccess();
  }
  thread::sleep(Duration::from_millis(250));
  can_create_priority_event_tap()
}

#[cfg(target_os = "macos")]
fn priority_shortcut_access_granted() -> bool {
  can_create_priority_event_tap()
}

#[cfg(target_os = "macos")]
fn shortcut_can_use_priority(shortcut: &str) -> bool {
  shortcut_to_key_combo(shortcut).is_some()
}

#[cfg(not(target_os = "macos"))]
fn request_priority_shortcut_access() -> bool {
  false
}

#[cfg(not(target_os = "macos"))]
fn priority_shortcut_access_granted() -> bool {
  false
}

#[cfg(not(target_os = "macos"))]
fn shortcut_can_use_priority(_shortcut: &str) -> bool {
  false
}

fn priority_permission_error() -> String {
  "开启“优先极刻快捷键”需要给极刻键盘监听权限。请在系统设置 > 隐私与安全性 > 输入监控/辅助功能中允许极刻，然后再试一次。".to_string()
}

fn screen_recording_permission_error() -> String {
  "截图需要屏幕录制权限。请在功能权限里打开“屏幕录制权限”；如果刚刚已经授权，请退出并重新打开极刻后再试一次。".to_string()
}

#[cfg(target_os = "macos")]
fn open_priority_permission_settings_window() -> Result<bool, String> {
  let urls = [
    "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent",
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
  ];

  for url in urls {
    let status = Command::new("/usr/bin/open")
      .arg(url)
      .status()
      .map_err(|error| error.to_string())?;

    if status.success() {
      return Ok(true);
    }
  }

  Err("无法打开系统授权设置。".to_string())
}

#[cfg(not(target_os = "macos"))]
fn open_priority_permission_settings_window() -> Result<bool, String> {
  Err("当前系统不支持打开 macOS 授权设置。".to_string())
}

#[tauri::command]
fn open_priority_permission_settings() -> Result<bool, String> {
  open_priority_permission_settings_window()
}

#[cfg(target_os = "macos")]
fn request_screen_recording_permission() -> bool {
  unsafe { CGRequestScreenCaptureAccess() }
}

#[cfg(not(target_os = "macos"))]
fn request_screen_recording_permission() -> bool {
  true
}

#[cfg(target_os = "macos")]
fn open_screen_recording_permission_settings_window() -> Result<bool, String> {
  let urls = [
    "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_ScreenCapture",
    "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
    "x-apple.systempreferences:com.apple.ScreenCapture-Settings.extension",
    "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenRecording",
  ];

  for url in urls {
    let status = Command::new("/usr/bin/open")
      .arg(url)
      .status()
      .map_err(|error| error.to_string())?;

    if status.success() {
      let _ = Command::new("/usr/bin/osascript")
        .arg("-e")
        .arg("tell application \"System Settings\" to activate")
        .status();
      return Ok(true);
    }
  }

  Err("无法打开屏幕录制授权设置。".to_string())
}

#[cfg(not(target_os = "macos"))]
fn open_screen_recording_permission_settings_window() -> Result<bool, String> {
  Err("当前系统不支持打开 macOS 屏幕录制授权设置。".to_string())
}

#[tauri::command]
fn open_screen_recording_permission_settings() -> Result<bool, String> {
  open_screen_recording_permission_settings_window()
}

#[cfg(target_os = "macos")]
fn start_wake_monitor(app: AppHandle, runtime: WakeRuntime) {
  thread::spawn(move || {
    let mut double_was_down = false;
    let mut double_last_tap: Option<Instant> = None;
    let mut long_was_down = false;
    let mut long_started_at: Option<Instant> = None;
    let mut long_triggered = false;
    let mut last_triggered_at = Instant::now() - Duration::from_secs(3);

    loop {
      let settings = runtime
        .settings
        .lock()
        .map(|settings| settings.clone())
        .unwrap_or_default();
      let now = Instant::now();

      if let Some(flags) = current_event_flags() {
        if settings.double_wake_enabled {
          let is_down = modifier_is_pressed(flags, &settings.double_wake_modifier);
          if is_down && !double_was_down {
            if double_last_tap
              .is_some_and(|last_tap| now.duration_since(last_tap) <= Duration::from_millis(360))
              && now.duration_since(last_triggered_at) > Duration::from_millis(700)
            {
              toggle_launcher(&app);
              last_triggered_at = now;
              double_last_tap = None;
            } else {
              double_last_tap = Some(now);
            }
          }
          double_was_down = is_down;
        } else {
          double_was_down = false;
          double_last_tap = None;
        }

        if settings.long_press_wake_enabled {
          let is_down = modifier_is_pressed(flags, &settings.long_press_wake_modifier);
          if is_down && !long_was_down {
            long_started_at = Some(now);
            long_triggered = false;
          }
          if is_down
            && !long_triggered
            && long_started_at.is_some_and(|started_at| now.duration_since(started_at) >= Duration::from_millis(650))
            && now.duration_since(last_triggered_at) > Duration::from_millis(900)
          {
            toggle_launcher(&app);
            last_triggered_at = now;
            long_triggered = true;
          }
          if !is_down {
            long_started_at = None;
            long_triggered = false;
          }
          long_was_down = is_down;
        } else {
          long_was_down = false;
          long_started_at = None;
          long_triggered = false;
        }
      }

      thread::sleep(Duration::from_millis(35));
    }
  });
}

#[cfg(not(target_os = "macos"))]
fn start_wake_monitor(_app: AppHandle, _runtime: WakeRuntime) {}

#[cfg(target_os = "macos")]
fn start_priority_shortcut_monitor(app: AppHandle, runtime: WakeRuntime) {
  thread::spawn(move || loop {
    let app_for_callback = app.clone();
    let runtime_for_callback = runtime.clone();
    let last_triggered_at = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(3)));
    let last_triggered_for_callback = last_triggered_at.clone();

    let result = CGEventTap::with_enabled(
      CGEventTapLocation::HID,
      CGEventTapPlacement::HeadInsertEventTap,
      CGEventTapOptions::Default,
      vec![CGEventType::KeyDown, CGEventType::FlagsChanged],
      move |_proxy, event_type, event| {
        if matches!(event_type, CGEventType::TapDisabledByTimeout | CGEventType::TapDisabledByUserInput) {
          return CallbackResult::Keep;
        }

        let settings = runtime_for_callback
          .settings
          .lock()
          .map(|settings| settings.clone())
          .unwrap_or_default();
        if !settings.prefer_geke_shortcuts {
          return CallbackResult::Keep;
        }

        let priority_shortcuts = runtime_for_callback
          .priority_shortcuts
          .lock()
          .map(|shortcuts| shortcuts.clone())
          .unwrap_or_default();
        let matched = priority_shortcuts
          .iter()
          .any(|shortcut| event_matches_shortcut(event_type, event, shortcut));
        if !matched {
          return CallbackResult::Keep;
        }

        let now = Instant::now();
        if let Ok(mut last_triggered_at) = last_triggered_for_callback.lock() {
          if now.duration_since(*last_triggered_at) < Duration::from_millis(300) {
            return CallbackResult::Drop;
          }
          *last_triggered_at = now;
        }

        if screenshot_plugin_is_active(&settings.screenshot_plugin)
          && event_matches_shortcut(event_type, event, &settings.screenshot_plugin.shortcut)
        {
          trigger_screenshot_shortcut(app_for_callback.clone());
        } else {
          toggle_launcher(&app_for_callback);
        }
        CallbackResult::Drop
      },
      CFRunLoop::run_current,
    );

    if result.is_ok() {
      break;
    }
    thread::sleep(Duration::from_secs(2));
  });
}

#[cfg(not(target_os = "macos"))]
fn start_priority_shortcut_monitor(_app: AppHandle, _runtime: WakeRuntime) {}

fn open_settings(app: &AppHandle, section: &str) {
  show_launcher(app);
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.emit("launcher:open-settings", section);
  }
}

fn parse_shortcut(value: &str) -> Result<Shortcut, String> {
  let has_key = value.split('+').any(|part| {
    !matches!(
      part.trim(),
      "CmdOrCtrl" | "CommandOrControl" | "Command" | "Cmd" | "Control" | "Ctrl" | "Alt" | "Option" | "Shift"
    )
  });
  if !has_key {
    return Err("快捷键需要包含一个字母、数字、空格或功能键；只有 Option、Command 这类修饰键无法注册为全局快捷键。".to_string());
  }

  let normalized = value
    .replace("CmdOrCtrl", "CommandOrControl")
    .replace("CommandOrControl", "Super")
    .replace("Command", "Super")
    .replace("Cmd", "Super")
    .replace("Option", "Alt")
    .replace("Return", "Enter");
  Shortcut::from_str(&normalized).map_err(|error| error.to_string())
}

fn register_toggle_shortcut(app: &AppHandle, shortcut: &str) -> Result<(), String> {
  let parsed = parse_shortcut(shortcut)?;
  let shortcut_manager = app.global_shortcut();
  if shortcut_manager.is_registered(parsed) {
    return Ok(());
  }
  shortcut_manager.register(parsed).map_err(|error| error.to_string())
}

fn unregister_global_shortcut(app: &AppHandle, shortcut: &str) {
  if let Ok(parsed) = parse_shortcut(shortcut) {
    let _ = app.global_shortcut().unregister(parsed);
  }
}

fn screenshot_plugin_is_active(plugin: &ScreenshotPluginSettings) -> bool {
  plugin.installed && plugin.enabled && !plugin.shortcut.trim().is_empty()
}

fn global_shortcuts_for_settings(settings: &LauncherSettings) -> Vec<String> {
  let mut shortcuts = Vec::new();
  if settings.multi_wake_enabled {
    shortcuts.push(settings.toggle_shortcut.clone());
  }
  if screenshot_plugin_is_active(&settings.screenshot_plugin) {
    shortcuts.push(settings.screenshot_plugin.shortcut.clone());
  }
  shortcuts
}

fn sync_global_shortcuts(app: &AppHandle, previous_settings: &LauncherSettings, next_settings: &LauncherSettings) -> Result<ShortcutSyncResult, String> {
  let previous: BTreeSet<String> = global_shortcuts_for_settings(previous_settings).into_iter().collect();
  let next: BTreeSet<String> = global_shortcuts_for_settings(next_settings).into_iter().collect();
  let mut all_global_shortcuts_registered = true;
  let mut registered_shortcuts = BTreeSet::new();
  let mut priority_shortcuts = BTreeSet::new();

  for shortcut in &next {
    match register_toggle_shortcut(app, shortcut) {
      Ok(()) => {
        registered_shortcuts.insert(shortcut.clone());
      }
      Err(error) => {
        if next_settings.prefer_geke_shortcuts && shortcut_can_use_priority(shortcut) {
          if !priority_shortcut_access_granted() {
            return Err(priority_permission_error());
          }
          all_global_shortcuts_registered = false;
          priority_shortcuts.insert(shortcut.clone());
        } else {
          return Err(error);
        }
      }
    }
  }

  for shortcut in previous.difference(&next) {
    unregister_global_shortcut(app, shortcut);
  }

  Ok(ShortcutSyncResult {
    all_registered: !next.is_empty() && all_global_shortcuts_registered,
    registered_shortcuts,
    priority_shortcuts,
  })
}

fn shortcut_matches_registered(shortcut: &Shortcut, value: &str) -> bool {
  parse_shortcut(value)
    .map(|candidate| candidate.id() == shortcut.id())
    .unwrap_or(false)
}

fn trigger_screenshot_shortcut(app: AppHandle) {
  thread::spawn(move || {
    let Some(state) = app.try_state::<Mutex<LauncherState>>() else {
      return;
    };
    let plugin = {
      let Ok(state) = state.lock() else {
        return;
      };
      state.settings.screenshot_plugin.clone()
    };
    if let Err(error) = run_screenshot_capture(&app, plugin) {
      let _ = app.emit("launcher:screenshot-error", error);
    }
  });
}

fn handle_global_shortcut(app: &AppHandle, shortcut: &Shortcut, event: ShortcutEvent) {
  if event.state() != ShortcutState::Pressed {
    return;
  }

  let is_screenshot_shortcut = app
    .try_state::<Mutex<LauncherState>>()
    .and_then(|state| state.lock().ok().map(|state| state.settings.screenshot_plugin.clone()))
    .is_some_and(|plugin| screenshot_plugin_is_active(&plugin) && shortcut_matches_registered(shortcut, &plugin.shortcut));

  if is_screenshot_shortcut {
    trigger_screenshot_shortcut(app.clone());
  } else {
    toggle_launcher(app);
  }
}

fn menu_copy(language: &str, key: &str) -> &'static str {
  match (normalize_language(language).as_str(), key) {
    ("zh-CN", "basic") => "基础设置",
    ("zh-CN", "paths") => "路径设置",
    ("zh-CN", "sound") => "操作声音",
    ("zh-CN", "import_export") => "导入导出",
    ("zh-CN", "appearance") => "外观模式",
    ("zh-CN", "animation") => "动画效果",
    ("zh-CN", "tray_icon") => "菜单图标",
    ("zh-CN", "permissions") => "功能权限",
    ("zh-CN", "autostart") => "开机自动启动",
    ("zh-CN", "shortcuts") => "快捷键说明",
    ("zh-CN", "plugins") => "更多插件",
    ("zh-CN", "quit") => "退出极刻",
    ("en", "basic") => "Basic Settings",
    ("en", "paths") => "Path Settings",
    ("en", "sound") => "Operation Sound",
    ("en", "import_export") => "Import / Export",
    ("en", "appearance") => "Appearance",
    ("en", "animation") => "Animation",
    ("en", "tray_icon") => "Menu Bar Icon",
    ("en", "permissions") => "Permissions",
    ("en", "autostart") => "Launch at Login",
    ("en", "shortcuts") => "Shortcut Guide",
    ("en", "plugins") => "More Plugins",
    ("en", "quit") => "Quit GEKE",
    _ => "GEKE",
  }
}

fn build_tray_menu(app: &AppHandle, language: &str) -> tauri::Result<Menu<tauri::Wry>> {
  let basic = MenuItem::with_id(app, "settings-basic", menu_copy(language, "basic"), true, None::<&str>)?;
  let paths = MenuItem::with_id(app, "settings-paths", menu_copy(language, "paths"), true, None::<&str>)?;
  let sound = MenuItem::with_id(app, "settings-sound", menu_copy(language, "sound"), true, None::<&str>)?;
  let import_export = MenuItem::with_id(app, "settings-import-export", menu_copy(language, "import_export"), true, None::<&str>)?;
  let appearance = MenuItem::with_id(app, "settings-appearance", menu_copy(language, "appearance"), true, None::<&str>)?;
  let animation = MenuItem::with_id(app, "settings-animation", menu_copy(language, "animation"), true, None::<&str>)?;
  let tray_icon = MenuItem::with_id(app, "settings-tray-icon", menu_copy(language, "tray_icon"), true, None::<&str>)?;
  let permissions = MenuItem::with_id(app, "settings-permissions", menu_copy(language, "permissions"), true, None::<&str>)?;
  let autostart = MenuItem::with_id(app, "settings-autostart", menu_copy(language, "autostart"), true, None::<&str>)?;
  let shortcuts = MenuItem::with_id(app, "settings-shortcuts", menu_copy(language, "shortcuts"), true, None::<&str>)?;
  let plugins = MenuItem::with_id(app, "settings-plugins", menu_copy(language, "plugins"), true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", menu_copy(language, "quit"), true, Some("Cmd+Q"))?;
  let separator = PredefinedMenuItem::separator(app)?;
  Menu::with_items(
    app,
    &[
      &basic,
      &paths,
      &sound,
      &import_export,
      &appearance,
      &animation,
      &tray_icon,
      &permissions,
      &autostart,
      &shortcuts,
      &plugins,
      &separator,
      &quit,
    ],
  )
}

fn apply_tray_settings(app: &AppHandle, settings: &LauncherSettings) -> Result<(), String> {
  if let Some(tray) = app.tray_by_id("main-tray") {
    let menu = build_tray_menu(app, &settings.language).map_err(|error| error.to_string())?;
    tray.set_menu(Some(menu)).map_err(|error| error.to_string())?;
    tray.set_visible(settings.menu_icon_visible).map_err(|error| error.to_string())?;
  }
  Ok(())
}

fn create_tray(app: &AppHandle, settings: &LauncherSettings) -> tauri::Result<()> {
  let menu = build_tray_menu(app, &settings.language)?;
  let icon = Image::from_bytes(include_bytes!("../icons/menu-bar-icon.png"))?;
  TrayIconBuilder::with_id("main-tray")
    .tooltip(APP_NAME)
    .icon(icon)
    .icon_as_template(true)
    .menu(&menu)
    .show_menu_on_left_click(true)
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click { .. } = event {
        let _ = tray.app_handle().tray_by_id("main-tray");
      }
    })
    .build(app)?;
  if let Some(tray) = app.tray_by_id("main-tray") {
    let _ = tray.set_visible(settings.menu_icon_visible);
  }
  Ok(())
}

#[tauri::command]
fn get_initial_apps(state: State<'_, Mutex<LauncherState>>) -> Result<LauncherPayload, String> {
  let state = state.lock().map_err(|error| error.to_string())?;
  Ok(create_payload("", &state))
}

#[tauri::command]
fn search_applications(query: String, state: State<'_, Mutex<LauncherState>>) -> Result<LauncherPayload, String> {
  let state = state.lock().map_err(|error| error.to_string())?;
  Ok(create_payload(&query, &state))
}

#[tauri::command]
fn rescan_applications(state: State<'_, Mutex<LauncherState>>) -> Result<LauncherPayload, String> {
  let mut state = state.lock().map_err(|error| error.to_string())?;
  state.apps = scan_applications(&valid_search_directories(&state.settings.app_search_paths));
  state.last_scan_at = Some(now_iso());
  Ok(create_payload("", &state))
}

#[tauri::command]
fn launch_application(app_path: String) -> Result<bool, String> {
  Command::new("/usr/bin/open")
    .arg(app_path)
    .status()
    .map_err(|error| error.to_string())
    .and_then(|status| {
      if status.success() {
        Ok(true)
      } else {
        Err("Failed to launch application.".to_string())
      }
    })
}

#[tauri::command]
fn hide_launcher(app: AppHandle) -> Result<bool, String> {
  hide_launcher_window(&app);
  Ok(true)
}

#[tauri::command]
fn get_settings(state: State<'_, Mutex<LauncherState>>) -> Result<SettingsPayload, String> {
  let state = state.lock().map_err(|error| error.to_string())?;
  Ok(settings_payload(&state))
}

#[tauri::command]
fn update_settings(
  app: AppHandle,
  state: State<'_, Mutex<LauncherState>>,
  wake_runtime: State<'_, WakeRuntime>,
  settings: LauncherSettings,
) -> Result<SettingsPayload, String> {
  let mut state = state.lock().map_err(|error| error.to_string())?;
  let mut next_settings = settings;
  normalize_settings(&mut next_settings);
  let app_paths_changed = next_settings.app_search_paths != state.settings.app_search_paths;
  let launch_at_login_changed = next_settings.launch_at_login != state.settings.launch_at_login;
  let tray_settings_changed =
    next_settings.menu_icon_visible != state.settings.menu_icon_visible || next_settings.language != state.settings.language;

  if enabled_wake_count(&next_settings) == 0 {
    return Err("至少需要保留一种唤起快捷键。".to_string());
  }

  if next_settings.prefer_geke_shortcuts && !state.settings.prefer_geke_shortcuts && !request_priority_shortcut_access() {
    let _ = open_priority_permission_settings_window();
    return Err(priority_permission_error());
  }

  let shortcut_sync = sync_global_shortcuts(&app, &state.settings, &next_settings)
    .map_err(|error| format!("快捷键不可用。{error}"))?;

  if launch_at_login_changed {
    if next_settings.launch_at_login {
      app.autolaunch().enable().map_err(|error| error.to_string())?;
    } else {
      app.autolaunch().disable().map_err(|error| error.to_string())?;
    }
  }

  save_settings(&next_settings)?;
  state.settings = next_settings;
  if app_paths_changed {
    state.apps = scan_applications(&valid_search_directories(&state.settings.app_search_paths));
    state.last_scan_at = Some(now_iso());
  }
  state.global_shortcuts_registered = shortcut_sync.all_registered;
  state.registered_shortcuts = shortcut_sync.registered_shortcuts;
  state.priority_shortcuts = shortcut_sync.priority_shortcuts;
  if let Ok(mut runtime_settings) = wake_runtime.settings.lock() {
    *runtime_settings = state.settings.clone();
  }
  if let Ok(mut runtime_priority_shortcuts) = wake_runtime.priority_shortcuts.lock() {
    *runtime_priority_shortcuts = state.priority_shortcuts.clone();
  }
  if tray_settings_changed {
    apply_tray_settings(&app, &state.settings)?;
  }
  let payload = settings_payload(&state);
  let _ = app.emit("launcher:settings-changed", &payload);
  Ok(payload)
}

fn file_kind(path: &Path) -> String {
  if path.is_dir() {
    return "folder".to_string();
  }
  path
    .extension()
    .and_then(|value| value.to_str())
    .map(|value| value.to_lowercase())
    .filter(|value| !value.is_empty())
    .unwrap_or_else(|| "file".to_string())
}

fn spotlight_escape(value: &str) -> String {
  value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn build_file_search_query(query: &str) -> String {
  query
    .split_whitespace()
    .take(4)
    .map(|term| {
      let escaped = spotlight_escape(term);
      format!("(kMDItemDisplayName == \"*{escaped}*\"cd || kMDItemFSName == \"*{escaped}*\"cd)")
    })
    .collect::<Vec<_>>()
    .join(" && ")
}

fn path_has_hidden_or_noisy_component(path: &Path) -> bool {
  path.components().any(|component| {
    let value = component.as_os_str().to_string_lossy();
    if value.starts_with('.') {
      return true;
    }
    matches!(
      value.as_ref(),
      "Library" | "Caches" | "tmp" | "temp" | "node_modules" | "target" | "__pycache__" | ".git"
    ) || value.ends_with(".app")
  })
}

fn file_result_is_visible(path: &Path) -> bool {
  if !path.exists() || path_has_hidden_or_noisy_component(path) {
    return false;
  }
  let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
    return false;
  };
  !name.trim().is_empty() && !name.starts_with('.')
}

fn file_score(path: &Path, query: &str) -> i32 {
  let query = query.to_lowercase();
  let name = path
    .file_name()
    .and_then(|value| value.to_str())
    .unwrap_or_default()
    .to_lowercase();
  if name == query {
    1200
  } else if name.starts_with(&query) {
    950
  } else if name.contains(&query) {
    700
  } else {
    120
  }
}

fn run_mdfind(query: &str, directories: &[PathBuf]) -> Result<String, String> {
  let mut command = Command::new("/usr/bin/mdfind");
  for directory in directories {
    command.arg("-onlyin").arg(directory);
  }
  let mut child = command
    .arg(query)
    .stdout(Stdio::piped())
    .stderr(Stdio::null())
    .spawn()
    .map_err(|error| error.to_string())?;

  let started_at = Instant::now();
  loop {
    if child.try_wait().map_err(|error| error.to_string())?.is_some() {
      let output = child.wait_with_output().map_err(|error| error.to_string())?;
      return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }
    if started_at.elapsed() >= Duration::from_millis(900) {
      let _ = child.kill();
      let output = child.wait_with_output().map_err(|error| error.to_string())?;
      return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }
    thread::sleep(Duration::from_millis(20));
  }
}

#[tauri::command]
fn search_files(query: String, state: State<'_, Mutex<LauncherState>>) -> Result<Vec<FileEntry>, String> {
  let trimmed_query = query.trim();
  if trimmed_query.chars().count() < 2 {
    return Ok(Vec::new());
  }

  let directories = {
    let state = state.lock().map_err(|error| error.to_string())?;
    valid_search_directories(&state.settings.file_search_paths)
  };
  if directories.is_empty() {
    return Ok(Vec::new());
  }

  let spotlight_query = build_file_search_query(trimmed_query);
  if spotlight_query.is_empty() {
    return Ok(Vec::new());
  }

  let stdout = run_mdfind(&spotlight_query, &directories)?;
  let mut seen_paths = BTreeSet::new();
  let mut results = stdout
    .lines()
    .filter_map(|line| {
      let path = PathBuf::from(line);
      if !seen_paths.insert(line.to_string()) || !file_result_is_visible(&path) {
        return None;
      }
      let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(line)
        .to_string();
      Some(FileEntry {
        id: format!("file:{line}"),
        name,
        path: line.to_string(),
        kind: file_kind(&path),
      })
    })
    .collect::<Vec<_>>();

  results.sort_by(|left, right| {
    file_score(Path::new(&right.path), trimmed_query)
      .cmp(&file_score(Path::new(&left.path), trimmed_query))
      .then(left.name.cmp(&right.name))
  });
  results.truncate(30);
  Ok(results)
}

#[tauri::command]
fn open_file(path: String) -> Result<bool, String> {
  Command::new("/usr/bin/open")
    .arg(path)
    .status()
    .map_err(|error| error.to_string())
    .and_then(|status| {
      if status.success() {
        Ok(true)
      } else {
        Err("Failed to open file.".to_string())
      }
    })
}

fn ensure_directory(path: &Path) -> Result<(), String> {
  fs::create_dir_all(path).map_err(|error| error.to_string())
}

fn run_status_with_timeout(command: &mut Command, failure: &str, timeout: Duration) -> Result<bool, String> {
  let mut child = command
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()
    .map_err(|error| error.to_string())?;

  let started_at = Instant::now();
  loop {
    if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
      return if status.success() {
        Ok(true)
      } else {
        Err(failure.to_string())
      };
    }

    if started_at.elapsed() >= timeout {
      let _ = child.kill();
      let _ = child.wait();
      return Err(failure.to_string());
    }

    thread::sleep(Duration::from_millis(20));
  }
}

fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
  let mut child = Command::new("/usr/bin/pbcopy")
    .stdin(Stdio::piped())
    .spawn()
    .map_err(|error| error.to_string())?;
  if let Some(stdin) = child.stdin.as_mut() {
    use std::io::Write;
    stdin.write_all(text.as_bytes()).map_err(|error| error.to_string())?;
  }
  let status = child.wait().map_err(|error| error.to_string())?;
  if status.success() {
    Ok(())
  } else {
    Err("无法复制内容。".to_string())
  }
}

fn current_datetime_parts() -> [String; 6] {
  let output = Command::new("/bin/date").arg("+%Y|%m|%d|%H|%M|%S").output();
  let value = output
    .ok()
    .and_then(|result| String::from_utf8(result.stdout).ok())
    .map(|value| value.trim().to_string())
    .unwrap_or_else(|| "1970|01|01|00|00|00".to_string());
  let mut parts = value.split('|').map(|part| part.to_string()).collect::<Vec<_>>();
  while parts.len() < 6 {
    parts.push("00".to_string());
  }
  [
    parts[0].clone(),
    parts[1].clone(),
    parts[2].clone(),
    parts[3].clone(),
    parts[4].clone(),
    parts[5].clone(),
  ]
}

fn screenshot_filename(format: &str) -> String {
  let [year, month, day, hour, minute, second] = current_datetime_parts();
  let mut filename = format
    .trim()
    .replace("yyyy", &year)
    .replace("MM", &month)
    .replace("dd", &day)
    .replace("HH", &hour)
    .replace("mm", &minute)
    .replace("ss", &second)
    .replace('/', "-")
    .replace(':', "-");
  if filename.is_empty() {
    filename = DEFAULT_SCREENSHOT_FILE_NAME_FORMAT
      .replace("yyyy", &year)
      .replace("MM", &month)
      .replace("dd", &day)
      .replace("HH", &hour)
      .replace("mm", &minute)
      .replace("ss", &second);
  }
  if !filename.to_lowercase().ends_with(".png") {
    filename.push_str(".png");
  }
  filename
}

fn screenshot_default_directory(plugin: &ScreenshotPluginSettings) -> PathBuf {
  let configured = expand_user_path(&plugin.save_location);
  if configured.is_dir() {
    configured
  } else {
    dirs_next::desktop_dir().unwrap_or_else(|| dirs_next::home_dir().unwrap_or_else(|| PathBuf::from(".")))
  }
}

fn screenshot_output_path(plugin: &ScreenshotPluginSettings) -> Result<PathBuf, String> {
  let filename = screenshot_filename(&plugin.file_name_format);
  let directory = screenshot_default_directory(plugin);
  ensure_directory(&directory)?;
  Ok(directory.join(filename))
}

fn ensure_png_extension(path: PathBuf) -> PathBuf {
  if path.extension().and_then(|extension| extension.to_str()).is_some_and(|extension| extension.eq_ignore_ascii_case("png")) {
    return path;
  }
  let mut path = path;
  path.set_extension("png");
  path
}

async fn screenshot_save_dialog_path(app: &AppHandle, plugin: &ScreenshotPluginSettings) -> Result<Option<PathBuf>, String> {
  let filename = screenshot_filename(&plugin.file_name_format);
  let directory = screenshot_default_directory(plugin);
  let mut dialog = app
    .dialog()
    .file()
    .set_title("保存极刻截图")
    .set_directory(directory)
    .set_file_name(&filename)
    .add_filter("PNG Image", &["png"]);

  if let Some(window) = app.get_webview_window("screenshot") {
    let _ = window.set_always_on_top(false);
    dialog = dialog.set_parent(&window);
  }

  let (sender, receiver) = mpsc::channel();
  dialog.save_file(move |path| {
    let _ = sender.send(path);
  });

  let selected_path = tauri::async_runtime::spawn_blocking(move || receiver.recv())
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())?;

  let Some(path) = selected_path else {
    return Ok(None);
  };
  let path = path.into_path().map_err(|error| error.to_string())?;
  Ok(Some(ensure_png_extension(path)))
}

async fn screenshot_output_path_for_save(app: &AppHandle, plugin: &ScreenshotPluginSettings) -> Result<Option<PathBuf>, String> {
  if plugin.save_behavior == "defaultFolder" {
    return screenshot_output_path(plugin).map(Some);
  }
  screenshot_save_dialog_path(app, plugin).await
}

#[cfg(test)]
fn screenshot_save_needs_dialog(plugin: &ScreenshotPluginSettings) -> bool {
  plugin.save_behavior != "defaultFolder"
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn screenshot_download_path_ignores_ask_dialog_behavior() {
    let directory = std::env::temp_dir().join(format!("geke-test-save-{}", std::process::id()));
    fs::create_dir_all(&directory).expect("test save directory should be created");
    let mut plugin = ScreenshotPluginSettings::default();
    plugin.save_behavior = "ask".to_string();
    plugin.save_location = directory.to_string_lossy().to_string();
    plugin.file_name_format = "极刻测试_yyyy-MM-dd_HH-mm-ss.png".to_string();

    let output_path = screenshot_output_path(&plugin).expect("screenshot output path should be generated");

    assert_eq!(output_path.parent(), Some(directory.as_path()));
    assert!(output_path.file_name().and_then(|name| name.to_str()).is_some_and(|name| name.starts_with("极刻测试_") && name.ends_with(".png")));

    let _ = fs::remove_dir_all(directory);
  }

  #[test]
  fn screenshot_save_behavior_uses_dialog_except_default_folder() {
    let mut plugin = ScreenshotPluginSettings::default();

    plugin.save_behavior = "ask".to_string();
    assert!(screenshot_save_needs_dialog(&plugin));

    plugin.save_behavior = "manual".to_string();
    assert!(screenshot_save_needs_dialog(&plugin));

    plugin.save_behavior = "defaultFolder".to_string();
    assert!(!screenshot_save_needs_dialog(&plugin));
  }

  #[test]
  fn screenshot_defaults_migrate_to_geke_names() {
    let mut plugin = ScreenshotPluginSettings {
      file_name_format: LEGACY_SCREENSHOT_FILE_NAME_FORMAT.to_string(),
      watermark_text: String::new(),
      ..ScreenshotPluginSettings::default()
    };

    normalize_screenshot_plugin(&mut plugin);

    assert_eq!(plugin.file_name_format, DEFAULT_SCREENSHOT_FILE_NAME_FORMAT);
    assert_eq!(plugin.watermark_text, DEFAULT_SCREENSHOT_WATERMARK_TEXT);
  }

  #[test]
  fn screenshot_composited_png_data_url_writes_file() {
    let directory = std::env::temp_dir().join(format!("geke-test-composite-{}", std::process::id()));
    fs::create_dir_all(&directory).expect("test composite directory should be created");
    let output_path = directory.join("composited.png");
    let data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    write_data_url_png(data_url, &output_path).expect("valid png data url should be written");

    let bytes = fs::read(&output_path).expect("written png should be readable");
    assert!(bytes.starts_with(b"\x89PNG\r\n\x1a\n"));

    let _ = fs::remove_dir_all(directory);
  }

  #[test]
  fn screenshot_capture_start_accepts_active_plugin() {
    let mut plugin = ScreenshotPluginSettings::default();
    plugin.installed = true;
    plugin.enabled = true;

    validate_screenshot_capture_start(&plugin).expect("active screenshot plugin should start and let the actual capture decide permissions");
  }

  #[test]
  fn screenshot_capture_start_rejects_disabled_plugin() {
    let mut plugin = ScreenshotPluginSettings::default();
    plugin.installed = true;
    plugin.enabled = false;

    let error = validate_screenshot_capture_start(&plugin).expect_err("disabled screenshot plugin should not start");

    assert!(error.contains("截图插件"));
  }

  #[cfg(target_os = "macos")]
  #[test]
  fn screenshot_overlay_level_stays_above_menu_bar_without_using_system_shielding() {
    let lower_bound = NSScreenSaverWindowLevel + 1;
    let upper_bound = (unsafe { CGShieldingWindowLevel() }) as isize + 1;
    assert_eq!(screenshot_overlay_window_level(), lower_bound + ((upper_bound - lower_bound) * 7) / 8);
    assert!(screenshot_overlay_window_level() > lower_bound);
    assert!(screenshot_overlay_window_level() < upper_bound);
  }
}

#[tauri::command]
fn run_screenshot_plugin(app: AppHandle, state: State<'_, Mutex<LauncherState>>) -> Result<bool, String> {
  let plugin = {
    let state = state.lock().map_err(|error| error.to_string())?;
    state.settings.screenshot_plugin.clone()
  };

  run_screenshot_capture(&app, plugin)
}

fn run_screenshot_capture(app: &AppHandle, plugin: ScreenshotPluginSettings) -> Result<bool, String> {
  validate_screenshot_capture_start(&plugin)?;
  if !begin_screenshot_start(app)? {
    return Ok(false);
  }

  close_screenshot_window_and_wait(app, Duration::from_millis(700));

  if !screen_recording_permission_granted() {
    finish_screenshot_start(app);
    let _ = request_screen_recording_permission();
    let _ = open_screen_recording_permission_settings_window();
    return Err(screen_recording_permission_error());
  }

  let image_path = match capture_full_screen_image() {
    Ok(path) => path,
    Err(error) => {
      finish_screenshot_start(app);
      let _ = request_screen_recording_permission();
      let _ = open_screen_recording_permission_settings_window();
      return Err(if error.contains("屏幕录制权限") {
        error
      } else {
        format!("{error}\n{}", screen_recording_permission_error())
      });
    }
  };
  let (image_width, image_height) = match png_dimensions(&image_path) {
    Ok(dimensions) => dimensions,
    Err(error) => {
      finish_screenshot_start(app);
      return Err(error);
    }
  };
  let image_bytes = match fs::read(&image_path) {
    Ok(bytes) => bytes,
    Err(error) => {
      finish_screenshot_start(app);
      return Err(error.to_string());
    }
  };
  let image_data_url = format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(image_bytes));

  let Some(session_state) = app.try_state::<Mutex<ScreenshotSessionState>>() else {
    finish_screenshot_start(app);
    return Err("截图会话状态不可用。".to_string());
  };
  {
    let mut session_state = match session_state.lock() {
      Ok(session_state) => session_state,
      Err(error) => {
        finish_screenshot_start(app);
        return Err(error.to_string());
      }
    };
    session_state.current = Some(ScreenshotSession {
      image_path,
      image_data_url,
      image_width,
      image_height,
      settings: plugin,
    });
  }

  if let Err(error) = enter_screenshot_capture_mode(app) {
    finish_screenshot_start(app);
    if let Some(session_state) = app.try_state::<Mutex<ScreenshotSessionState>>() {
      if let Ok(mut session_state) = session_state.lock() {
        session_state.current = None;
        session_state.window_ready = false;
      }
    }
    return Err(error);
  }
  match open_screenshot_window_on_main_thread(app) {
    Ok(value) => {
      schedule_screenshot_ready_watchdog(app);
      finish_screenshot_start(app);
      Ok(value)
    }
    Err(error) => {
      if let Some(session_state) = app.try_state::<Mutex<ScreenshotSessionState>>() {
        if let Ok(mut session_state) = session_state.lock() {
          session_state.current = None;
          session_state.starting = false;
          session_state.window_ready = false;
        }
      }
      exit_screenshot_capture_mode(app);
      Err(error)
    }
  }
}

fn validate_screenshot_capture_start(plugin: &ScreenshotPluginSettings) -> Result<(), String> {
  if !screenshot_plugin_is_active(plugin) {
    return Err("截图插件未下载或已关闭。".to_string());
  }
  Ok(())
}

#[cfg(target_os = "macos")]
fn screen_recording_permission_granted() -> bool {
  unsafe { CGPreflightScreenCaptureAccess() }
}

#[cfg(not(target_os = "macos"))]
fn screen_recording_permission_granted() -> bool {
  true
}

fn begin_screenshot_start(app: &AppHandle) -> Result<bool, String> {
  let Some(session_state) = app.try_state::<Mutex<ScreenshotSessionState>>() else {
    return Err("截图会话状态不可用。".to_string());
  };
  let mut session_state = session_state.lock().map_err(|error| error.to_string())?;
  if session_state.starting || session_state.current.is_some() {
    return Ok(false);
  }
  session_state.starting = true;
  session_state.current = None;
  session_state.window_ready = false;
  Ok(true)
}

fn finish_screenshot_start(app: &AppHandle) {
  if let Some(session_state) = app.try_state::<Mutex<ScreenshotSessionState>>() {
    if let Ok(mut session_state) = session_state.lock() {
      session_state.starting = false;
    }
  }
}

fn screenshot_capture_is_active_or_starting(app: &AppHandle) -> bool {
  app
    .try_state::<Mutex<ScreenshotSessionState>>()
    .and_then(|session_state| {
      session_state
        .lock()
        .ok()
        .map(|session_state| session_state.starting || session_state.current.is_some())
    })
    .unwrap_or(false)
}

fn schedule_screenshot_ready_watchdog(app: &AppHandle) {
  let app = app.clone();
  thread::spawn(move || {
    thread::sleep(Duration::from_secs(3));
    let should_cancel = app
      .try_state::<Mutex<ScreenshotSessionState>>()
      .and_then(|session_state| {
        session_state.lock().ok().map(|session_state| {
          session_state.current.is_some() && !session_state.window_ready
        })
      })
      .unwrap_or(false);
    if !should_cancel {
      return;
    }

    if let Some(session_state) = app.try_state::<Mutex<ScreenshotSessionState>>() {
      if let Ok(mut session_state) = session_state.lock() {
        session_state.current = None;
        session_state.starting = false;
        session_state.window_ready = false;
      }
    }
    hide_screenshot_window(&app);
    exit_screenshot_capture_mode(&app);
    let _ = app.emit("launcher:screenshot-error", "截图窗口没有正常显示，已自动退出截图模式。");
  });
}

#[cfg(target_os = "macos")]
fn restore_window_visibility_for_capture(window: &tauri::WebviewWindow) {
  let Ok(ns_window) = window.ns_window() else {
    return;
  };
  if ns_window.is_null() {
    return;
  }
  unsafe {
    let ns_window = &*(ns_window.cast::<NSWindow>());
    ns_window.setAlphaValue(1.0);
  }
}

#[cfg(not(target_os = "macos"))]
fn restore_window_visibility_for_capture(_window: &tauri::WebviewWindow) {}

#[cfg(target_os = "macos")]
fn enter_screenshot_capture_mode(_app: &AppHandle) -> Result<(), String> {
  Ok(())
}

#[cfg(not(target_os = "macos"))]
fn enter_screenshot_capture_mode(_app: &AppHandle) -> Result<(), String> {
  Ok(())
}

#[cfg(target_os = "macos")]
fn exit_screenshot_capture_mode(_app: &AppHandle) {}

#[cfg(not(target_os = "macos"))]
fn exit_screenshot_capture_mode(_app: &AppHandle) {}

fn capture_full_screen_image() -> Result<PathBuf, String> {
  let timestamp = now_iso().replace(':', "-").replace('T', "-").replace('Z', "");
  let output_path = std::env::temp_dir().join(format!("geke-screen-{timestamp}.png"));
  run_status_with_timeout(
    Command::new("/usr/sbin/screencapture").arg("-x").arg(&output_path),
    "无法捕获屏幕，请检查系统设置里的屏幕录制权限。",
    Duration::from_secs(5),
  )?;
  let metadata = fs::metadata(&output_path).map_err(|error| error.to_string())?;
  if metadata.len() == 0 {
    return Err("截图文件为空，请检查屏幕录制权限。".to_string());
  }
  Ok(output_path)
}

fn png_dimensions(path: &Path) -> Result<(u32, u32), String> {
  let bytes = fs::read(path).map_err(|error| error.to_string())?;
  if bytes.len() < 24 || &bytes[0..8] != b"\x89PNG\r\n\x1a\n" {
    return Err("截图文件格式不正确。".to_string());
  }
  let width = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]);
  let height = u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]);
  if width == 0 || height == 0 {
    return Err("截图尺寸无效。".to_string());
  }
  Ok((width, height))
}

fn open_screenshot_window(app: &AppHandle) -> Result<bool, String> {
  if app.get_webview_window("screenshot").is_some() {
    close_screenshot_window_and_wait(app, Duration::from_millis(700));
  }

  let (x, y, width, height) = screenshot_window_geometry(app);
  let build_result = WebviewWindowBuilder::new(app, "screenshot", WebviewUrl::App("screenshot.html".into()))
    .title("极刻截图")
    .position(x, y)
    .inner_size(width, height)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .visible_on_all_workspaces(true)
    .skip_taskbar(true)
    .resizable(false)
    .visible(false)
    .build()
    .map(|window| {
      configure_screenshot_window(&window);
    });

  if let Err(error) = build_result {
    let message = error.to_string();
    if message.contains("already exists") {
      close_screenshot_window_and_wait(app, Duration::from_millis(900));
      WebviewWindowBuilder::new(app, "screenshot", WebviewUrl::App("screenshot.html".into()))
        .title("极刻截图")
        .position(x, y)
        .inner_size(width, height)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .build()
        .map(|window| {
          configure_screenshot_window(&window);
        })
        .map_err(|retry_error| retry_error.to_string())?;
      return Ok(true);
    }
    return Err(message);
  }
  Ok(true)
}

fn open_screenshot_window_on_main_thread(app: &AppHandle) -> Result<bool, String> {
  let (sender, receiver) = mpsc::channel();
  let app_for_window = app.clone();
  app
    .run_on_main_thread(move || {
      let _ = sender.send(open_screenshot_window(&app_for_window));
    })
    .map_err(|error| error.to_string())?;

  receiver
    .recv_timeout(Duration::from_secs(4))
    .map_err(|error| format!("打开截图窗口超时：{error}"))?
}

fn configure_screenshot_window(window: &tauri::WebviewWindow) {
  let _ = window.set_always_on_top(true);
  prepare_screenshot_window(window);
  let _ = window.show();
  bring_screenshot_window_front(window);
}

#[cfg(target_os = "macos")]
fn screenshot_overlay_window_level() -> isize {
  if let Some(level) = option_env!("GEKE_SCREENSHOT_OVERLAY_LEVEL")
    .and_then(|value| value.trim().parse::<isize>().ok())
  {
    return level;
  }

  let lower_bound = NSScreenSaverWindowLevel + 1;
  let upper_bound = (unsafe { CGShieldingWindowLevel() }) as isize + 1;
  lower_bound + ((upper_bound - lower_bound) * 7) / 8
}

#[cfg(target_os = "macos")]
fn prepare_screenshot_window(window: &tauri::WebviewWindow) {
  let Ok(ns_window) = window.ns_window() else {
    return;
  };
  if ns_window.is_null() {
    return;
  }
  unsafe {
    let ns_window = &*(ns_window.cast::<NSWindow>());
    ns_window.setStyleMask(ns_window.styleMask() | NSWindowStyleMask::NonactivatingPanel);
    ns_window.setOpaque(false);
    ns_window.setHasShadow(false);
    let behavior =
      NSWindowCollectionBehavior::CanJoinAllSpaces
        | NSWindowCollectionBehavior::FullScreenAuxiliary
        | NSWindowCollectionBehavior::Transient
        | NSWindowCollectionBehavior::Stationary
        | NSWindowCollectionBehavior::IgnoresCycle;
    ns_window.setCollectionBehavior(behavior);
    ns_window.setCanHide(false);
    ns_window.setMovable(false);
    ns_window.setIgnoresMouseEvents(false);
    ns_window.setLevel(screenshot_overlay_window_level());
    if let Some(screen) = ns_window
      .screen()
      .or_else(|| MainThreadMarker::new().and_then(NSScreen::mainScreen))
    {
      ns_window.setFrame_display(screen.frame(), true);
    }
  }
}

#[cfg(target_os = "macos")]
fn bring_screenshot_window_front(window: &tauri::WebviewWindow) {
  let Ok(ns_window) = window.ns_window() else {
    return;
  };
  if ns_window.is_null() {
    return;
  }
  unsafe {
    let ns_window = &*(ns_window.cast::<NSWindow>());
    ns_window.orderFrontRegardless();
  }
}

#[cfg(not(target_os = "macos"))]
fn prepare_screenshot_window(_window: &tauri::WebviewWindow) {}

#[cfg(not(target_os = "macos"))]
fn bring_screenshot_window_front(_window: &tauri::WebviewWindow) {}

#[tauri::command]
fn show_screenshot_window(app: AppHandle) -> Result<bool, String> {
  let Some(window) = app.get_webview_window("screenshot") else {
    return Ok(false);
  };
  prepare_screenshot_window(&window);
  window.show().map_err(|error| error.to_string())?;
  bring_screenshot_window_front(&window);
  let _ = window.set_focus();
  if let Some(session_state) = app.try_state::<Mutex<ScreenshotSessionState>>() {
    if let Ok(mut session_state) = session_state.lock() {
      session_state.window_ready = true;
    }
  }
  Ok(true)
}

fn screenshot_window_geometry(app: &AppHandle) -> (f64, f64, f64, f64) {
  let monitor = app.get_webview_window("main").and_then(|window| {
    window
      .current_monitor()
      .ok()
      .flatten()
      .or_else(|| window.primary_monitor().ok().flatten())
  });
  if let Some(monitor) = monitor {
    let scale = monitor.scale_factor().max(1.0);
    let position = monitor.position();
    let size = monitor.size();
    return (
      position.x as f64 / scale,
      position.y as f64 / scale,
      size.width as f64 / scale,
      size.height as f64 / scale,
    );
  }
  (0.0, 0.0, 1440.0, 900.0)
}

fn close_screenshot_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("screenshot") {
    let _ = window.close();
  }
}

fn hide_screenshot_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("screenshot") {
    let _ = window.hide();
  }
}

fn close_screenshot_window_and_wait(app: &AppHandle, timeout: Duration) {
  if app.get_webview_window("screenshot").is_none() {
    return;
  }
  close_screenshot_window(app);

  let started_at = Instant::now();
  while started_at.elapsed() < timeout {
    if app.get_webview_window("screenshot").is_none() {
      break;
    }
    thread::sleep(Duration::from_millis(20));
  }
}

#[tauri::command]
fn get_screenshot_session(state: State<'_, Mutex<ScreenshotSessionState>>) -> Result<ScreenshotSessionPayload, String> {
  let session = state
    .lock()
    .map_err(|error| error.to_string())?
    .current
    .clone()
    .ok_or_else(|| "截图会话不存在。".to_string())?;
  Ok(ScreenshotSessionPayload {
    image_data_url: session.image_data_url,
    image_width: session.image_width,
    image_height: session.image_height,
    settings: session.settings,
  })
}

fn crop_screenshot_selection(session: &ScreenshotSession, selection: ScreenshotSelection, output_path: &Path) -> Result<(), String> {
  let x = selection.x.min(session.image_width.saturating_sub(1));
  let y = selection.y.min(session.image_height.saturating_sub(1));
  let width = selection.width.min(session.image_width.saturating_sub(x)).max(1);
  let height = selection.height.min(session.image_height.saturating_sub(y)).max(1);
  if width < 2 || height < 2 {
    return Err("截图区域太小。".to_string());
  }

  let image = image::ImageReader::open(&session.image_path)
    .map_err(|error| error.to_string())?
    .with_guessed_format()
    .map_err(|error| error.to_string())?
    .decode()
    .map_err(|error| error.to_string())?;
  let cropped = image.crop_imm(x, y, width, height);
  if let Some(parent) = output_path.parent() {
    ensure_directory(parent)?;
  }
  cropped
    .save_with_format(output_path, image::ImageFormat::Png)
    .map_err(|error| error.to_string())
}

fn copy_image_to_clipboard(path: &Path) -> Result<(), String> {
  let output = Command::new("/usr/bin/osascript")
    .arg("-e")
    .arg("on run argv")
    .arg("-e")
    .arg("set the clipboard to (read (POSIX file (item 1 of argv)) as «class PNGf»)")
    .arg("-e")
    .arg("end run")
    .arg(path)
    .output()
    .map_err(|error| error.to_string())?;
  if output.status.success() {
    Ok(())
  } else {
    let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if error.is_empty() { "无法复制截图到剪贴板。".to_string() } else { error })
  }
}

fn write_data_url_png(data_url: &str, output_path: &Path) -> Result<(), String> {
  let payload = data_url
    .strip_prefix("data:image/png;base64,")
    .ok_or_else(|| "截图合成数据格式不正确。".to_string())?;
  let bytes = general_purpose::STANDARD
    .decode(payload)
    .map_err(|_| "截图合成数据无法解析。".to_string())?;
  if bytes.len() < 24 || &bytes[0..8] != b"\x89PNG\r\n\x1a\n" {
    return Err("截图合成数据不是有效 PNG。".to_string());
  }
  if let Some(parent) = output_path.parent() {
    ensure_directory(parent)?;
  }
  fs::write(output_path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
async fn complete_screenshot_capture(
  app: AppHandle,
  state: State<'_, Mutex<ScreenshotSessionState>>,
  selection: ScreenshotSelection,
  action: String,
  composited_image_data_url: Option<String>,
) -> Result<ScreenshotCompletePayload, String> {
  let session = state
    .lock()
    .map_err(|error| error.to_string())?
    .current
    .clone()
    .ok_or_else(|| "截图会话不存在。".to_string())?;
  let should_save = action == "save";
  let output_path = if should_save {
    match screenshot_output_path_for_save(&app, &session.settings).await? {
      Some(path) => path,
      None => {
        let mut state = state.lock().map_err(|error| error.to_string())?;
        state.current = None;
        state.starting = false;
        state.window_ready = false;
        drop(state);
        hide_screenshot_window(&app);
        exit_screenshot_capture_mode(&app);
        return Ok(ScreenshotCompletePayload {
          saved_path: None,
          copied: false,
        });
      }
    }
  } else {
    let timestamp = now_iso().replace(':', "-").replace('T', "-").replace('Z', "");
    std::env::temp_dir().join(format!("geke-selection-{timestamp}.png"))
  };

  let write_result = if let Some(data_url) = composited_image_data_url.as_deref().filter(|value| !value.is_empty()) {
    write_data_url_png(data_url, &output_path)
  } else {
    crop_screenshot_selection(&session, selection, &output_path)
  };
  if let Err(error) = write_result {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    state.current = None;
    state.starting = false;
    state.window_ready = false;
    drop(state);
    hide_screenshot_window(&app);
    exit_screenshot_capture_mode(&app);
    return Err(error);
  }
  let mut copied = false;

  {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    state.current = None;
    state.starting = false;
    state.window_ready = false;
  }
  hide_screenshot_window(&app);
  exit_screenshot_capture_mode(&app);

  if should_save {
    if session.settings.auto_copy_path {
      copy_text_to_clipboard(&output_path.to_string_lossy())?;
      copied = true;
    }
    if session.settings.auto_open_folder {
      let _ = Command::new("/usr/bin/open").arg("-R").arg(&output_path).spawn();
    }
  } else {
    copy_image_to_clipboard(&output_path)?;
    copied = true;
  }

  Ok(ScreenshotCompletePayload {
    saved_path: should_save.then(|| output_path.to_string_lossy().to_string()),
    copied,
  })
}

#[tauri::command]
fn cancel_screenshot_capture(app: AppHandle, state: State<'_, Mutex<ScreenshotSessionState>>) -> Result<bool, String> {
  {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    state.current = None;
    state.starting = false;
    state.window_ready = false;
  }
  hide_screenshot_window(&app);
  exit_screenshot_capture_mode(&app);
  Ok(true)
}

#[tauri::command]
fn restart_screenshot_capture(
  app: AppHandle,
  launcher_state: State<'_, Mutex<LauncherState>>,
  screenshot_state: State<'_, Mutex<ScreenshotSessionState>>,
  seconds: u64,
) -> Result<bool, String> {
  let plugin = {
    let state = launcher_state.lock().map_err(|error| error.to_string())?;
    state.settings.screenshot_plugin.clone()
  };
  {
    let mut state = screenshot_state.lock().map_err(|error| error.to_string())?;
    state.current = None;
    state.starting = false;
    state.window_ready = false;
  }
  hide_screenshot_window(&app);
  exit_screenshot_capture_mode(&app);

  let delay_seconds = seconds.clamp(1, 10);
  let app_for_thread = app.clone();
  thread::spawn(move || {
    thread::sleep(Duration::from_secs(delay_seconds));
    if let Err(error) = run_screenshot_capture(&app_for_thread, plugin) {
      let _ = app_for_thread.emit("launcher:screenshot-error", error);
    }
  });

  Ok(true)
}

#[tauri::command]
async fn export_settings_config(
  app: AppHandle,
  state: State<'_, Mutex<LauncherState>>,
) -> Result<bool, String> {
  let Some(path) = app
    .dialog()
    .file()
    .set_title("导出极刻配置")
    .set_file_name("geke-settings.json")
    .blocking_save_file()
  else {
    return Ok(false);
  };
  let path = path.into_path().map_err(|error| error.to_string())?;
  let settings = {
    let state = state.lock().map_err(|error| error.to_string())?;
    state.settings.clone()
  };
  let content = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
  fs::write(path, format!("{content}\n")).map_err(|error| error.to_string())?;
  Ok(true)
}

#[tauri::command]
async fn import_settings_config(app: AppHandle) -> Result<Option<LauncherSettings>, String> {
  let Some(path) = app
    .dialog()
    .file()
    .set_title("导入极刻配置")
    .add_filter("GEKE Settings", &["json"])
    .blocking_pick_file()
  else {
    return Ok(None);
  };
  let path = path.into_path().map_err(|error| error.to_string())?;
  let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
  let mut settings = serde_json::from_str::<LauncherSettings>(&content).map_err(|error| error.to_string())?;
  normalize_settings(&mut settings);
  Ok(Some(settings))
}

#[tauri::command]
async fn select_search_paths(
  app: AppHandle,
  kind: String,
  current_paths: Vec<String>,
) -> Result<Vec<String>, String> {
  let title = if kind == "apps" {
    "选择应用扫描目录"
  } else {
    "选择文件搜索目录"
  };
  let mut dialog = app
    .dialog()
    .file()
    .set_title(title)
    .set_directory(first_existing_directory(&current_paths))
    .set_can_create_directories(false);

  if let Some(window) = app.get_webview_window("main") {
    dialog = dialog.set_parent(&window);
  }

  let Some(paths) = dialog.blocking_pick_folders() else {
    return Ok(Vec::new());
  };

  Ok(paths
    .into_iter()
    .filter_map(|path| path.into_path().ok())
    .map(|path| path.to_string_lossy().to_string())
    .collect())
}

#[tauri::command]
fn authorize_current_search_paths(current_paths: Vec<String>) -> Result<Vec<String>, String> {
  let mut blocked_paths = Vec::new();

  for path in current_paths {
    let expanded_path = expand_user_path(&path);
    if !expanded_path.is_dir() {
      blocked_paths.push(path);
      continue;
    }

    match fs::read_dir(&expanded_path) {
      Ok(mut entries) => {
        let _ = entries.next();
      }
      Err(_) => blocked_paths.push(path),
    }
  }

  Ok(blocked_paths)
}

fn main() {
  let wake_runtime = WakeRuntime {
    settings: Arc::new(Mutex::new(LauncherSettings::default())),
    priority_shortcuts: Arc::new(Mutex::new(BTreeSet::new())),
  };
  tauri::Builder::default()
    .plugin(
      tauri_plugin_global_shortcut::Builder::new()
        .with_handler(handle_global_shortcut)
        .build(),
    )
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_autostart::init(
      MacosLauncher::LaunchAgent,
      Some(vec!["--from-autostart"]),
    ))
    .plugin(tauri_plugin_opener::init())
    .manage(wake_runtime.clone())
    .manage(Mutex::new(LauncherState::default()))
    .manage(Mutex::new(ScreenshotSessionState::default()))
    .invoke_handler(tauri::generate_handler![
      get_initial_apps,
      search_applications,
      rescan_applications,
      launch_application,
      hide_launcher,
      get_settings,
      update_settings,
      search_files,
      open_file,
      export_settings_config,
      import_settings_config,
      select_search_paths,
      open_priority_permission_settings,
      open_screen_recording_permission_settings,
      authorize_current_search_paths,
      run_screenshot_plugin,
      get_screenshot_session,
      show_screenshot_window,
      complete_screenshot_capture,
      cancel_screenshot_capture,
      restart_screenshot_capture,
    ])
    .setup(move |app| {
      let mut settings = load_settings();
      if let Ok(enabled) = app.autolaunch().is_enabled() {
        settings.launch_at_login = enabled;
      }
      let apps = scan_applications(&valid_search_directories(&settings.app_search_paths));
      let default_settings = LauncherSettings::default();
      let shortcut_sync = sync_global_shortcuts(app.handle(), &default_settings, &settings).unwrap_or_else(|_| ShortcutSyncResult {
        all_registered: false,
        registered_shortcuts: BTreeSet::new(),
        priority_shortcuts: BTreeSet::new(),
      });
      if let Some(runtime) = app.try_state::<WakeRuntime>() {
        if let Ok(mut runtime_settings) = runtime.settings.lock() {
          *runtime_settings = settings.clone();
        }
        if let Ok(mut runtime_priority_shortcuts) = runtime.priority_shortcuts.lock() {
          *runtime_priority_shortcuts = shortcut_sync.priority_shortcuts.clone();
        }
      }
      start_wake_monitor(app.handle().clone(), wake_runtime.clone());
      start_priority_shortcut_monitor(app.handle().clone(), wake_runtime.clone());
      if let Some(state) = app.try_state::<Mutex<LauncherState>>() {
        if let Ok(mut state) = state.lock() {
          state.apps = apps;
          state.last_scan_at = Some(now_iso());
          state.settings = settings.clone();
          state.global_shortcuts_registered = shortcut_sync.all_registered;
          state.registered_shortcuts = shortcut_sync.registered_shortcuts.clone();
          state.priority_shortcuts = shortcut_sync.priority_shortcuts.clone();
        }
      }

      create_tray(app.handle(), &settings)?;
      if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.set_focus()?;
      }
      Ok(())
    })
    .on_menu_event(|app, event| match event.id().as_ref() {
      "settings-basic" => open_settings(app, "basic"),
      "settings-paths" => open_settings(app, "paths"),
      "settings-sound" => open_settings(app, "sound"),
      "settings-import-export" => open_settings(app, "import-export"),
      "settings-appearance" => open_settings(app, "appearance"),
      "settings-animation" => open_settings(app, "animation"),
      "settings-tray-icon" => open_settings(app, "tray-icon"),
      "settings-permissions" => open_settings(app, "permissions"),
      "settings-autostart" => open_settings(app, "autostart"),
      "settings-shortcuts" => open_settings(app, "shortcuts"),
      "settings-plugins" => open_settings(app, "plugins"),
      "quit" => app.exit(0),
      _ => {}
    })
    .build(tauri::generate_context!())
    .expect("error while building GEKE")
    .run(|app, event| {
      #[cfg(target_os = "macos")]
      if let tauri::RunEvent::Reopen { .. } = event {
        if !screenshot_capture_is_active_or_starting(app) {
          toggle_launcher(app);
        }
      }
    });
}
