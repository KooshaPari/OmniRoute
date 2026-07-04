use std::collections::HashMap;

#[derive(Default)]
pub struct EnvManager { overrides: HashMap<String,String> }
impl EnvManager {
    pub fn new() -> Self { Self::default() }
    pub fn set(&mut self, key: impl Into<String>, val: impl Into<String>) { self.overrides.insert(key.into(), val.into()); }
    pub fn get(&self, key: &str) -> Option<String> {
        if let Some(v) = self.overrides.get(key) { return Some(v.clone()); }
        std::env::var(key).ok()
    }
    pub fn get_or(&self, key: &str, default: &str) -> String { self.get(key).unwrap_or_else(|| default.to_string()) }
    pub fn require(&self, key: &str) -> Result<String,String> { self.get(key).ok_or_else(|| format!("required env '{}' not set", key)) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn override_wins() { let mut e=EnvManager::new(); e.set("MY_OVERRIDE_KEY","val"); assert_eq!(e.get("MY_OVERRIDE_KEY"),Some("val".into())); }
    #[test] fn missing_none() { let e=EnvManager::new(); assert_eq!(e.get("DEFINITELY_NOT_SET_XYZ123"),None); }
    #[test] fn get_or_default() { let e=EnvManager::new(); assert_eq!(e.get_or("DEFINITELY_NOT_SET_XYZ123","fallback"),"fallback"); }
    #[test] fn require_missing_err() { let e=EnvManager::new(); assert!(e.require("DEFINITELY_NOT_SET_XYZ123").is_err()); }
    #[test] fn require_present_ok() { let mut e=EnvManager::new(); e.set("K","V"); assert_eq!(e.require("K").unwrap(),"V"); }
}
