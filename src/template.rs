use std::collections::HashMap;

pub struct Template { pub pattern: String }
impl Template {
    pub fn new(pattern: impl Into<String>) -> Self { Self { pattern: pattern.into() } }
    pub fn render(&self, vars: &HashMap<String, String>) -> String {
        let mut out = String::new();
        let mut chars = self.pattern.chars().peekable();
        while let Some(c) = chars.next() {
            if c == '{' {
                let mut name = String::new();
                while let Some(&nc) = chars.peek() {
                    if nc == '}' { chars.next(); break; }
                    name.push(nc);
                    chars.next();
                }
                if let Some(v) = vars.get(&name) { out.push_str(v); } else { out.push('{'); out.push_str(&name); out.push('}'); }
            } else { out.push(c); }
        }
        out
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn single_var() { let mut v = HashMap::new(); v.insert("name".to_string(), "world".to_string()); assert_eq!(Template::new("hello {name}").render(&v), "hello world"); }
    #[test] fn multiple_vars() { let mut v = HashMap::new(); v.insert("a".to_string(), "1".to_string()); v.insert("b".to_string(), "2".to_string()); assert_eq!(Template::new("{a}-{b}").render(&v), "1-2"); }
    #[test] fn missing_var_keeps_placeholder() { let v = HashMap::new(); assert_eq!(Template::new("{x}").render(&v), "{x}"); }
    #[test] fn no_vars() { let v = HashMap::new(); assert_eq!(Template::new("plain").render(&v), "plain"); }
    #[test] fn empty_template() { let v = HashMap::new(); assert_eq!(Template::new("").render(&v), ""); }
}
