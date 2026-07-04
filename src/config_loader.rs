use std::collections::HashMap;

#[derive(Debug,Clone,Default)]
pub struct Config { pub values: HashMap<String,String> }
impl Config {
    pub fn new() -> Self { Self::default() }
    pub fn get(&self, key: &str) -> Option<&str> { self.values.get(key).map(|s| s.as_str()) }
    pub fn set(&mut self, key: impl Into<String>, val: impl Into<String>) { self.values.insert(key.into(), val.into()); }
    pub fn get_or<'a>(&'a self, key: &str, default: &'a str) -> &'a str { self.values.get(key).map(|s| s.as_str()).unwrap_or(default) }
}

pub fn load_from_str(s: &str) -> Result<Config, String> {
    let mut cfg = Config::new();
    for line in s.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') { continue; }
        if let Some((k, v)) = line.split_once('=') { cfg.set(k.trim(), v.trim()); }
        else { return Err(format!("invalid line: {}", line)); }
    }
    Ok(cfg)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn parse_kv() { let c=load_from_str("HOST=localhost\nPORT=8080").unwrap(); assert_eq!(c.get("HOST"),Some("localhost")); assert_eq!(c.get("PORT"),Some("8080")); }
    #[test] fn skip_comments() { let c=load_from_str("# comment\nKEY=val").unwrap(); assert_eq!(c.values.len(),1); }
    #[test] fn default_fallback() { let c=Config::new(); assert_eq!(c.get_or("x","def"),"def"); }
    #[test] fn invalid_line_err() { assert!(load_from_str("BADLINE").is_err()); }
    #[test] fn set_get() { let mut c=Config::new(); c.set("k","v"); assert_eq!(c.get("k"),Some("v")); }
}
