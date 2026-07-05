#[derive(Debug,PartialEq)]
pub struct Arg { pub key: String, pub value: Option<String> }

pub fn parse(args: &[String]) -> Vec<Arg> {
    let mut result = Vec::new();
    let mut i = 0;
    while i < args.len() {
        let a = &args[i];
        if let Some(stripped) = a.strip_prefix("--") {
            if let Some(eq_pos) = stripped.find('=') {
                result.push(Arg { key: stripped[..eq_pos].to_string(), value: Some(stripped[eq_pos+1..].to_string()) });
            } else {
                if i + 1 < args.len() && !args[i+1].starts_with("--") {
                    result.push(Arg { key: stripped.to_string(), value: Some(args[i+1].clone()) });
                    i += 1;
                } else {
                    result.push(Arg { key: stripped.to_string(), value: None });
                }
            }
        } else if let Some(stripped) = a.strip_prefix("-") {
            result.push(Arg { key: stripped.to_string(), value: None });
        } else {
            result.push(Arg { key: a.clone(), value: None });
        }
        i += 1;
    }
    result
}

pub fn lookup<'a>(args: &'a [Arg], key: &str) -> Option<&'a str> {
    args.iter().find(|a| a.key == key).and_then(|a| a.value.as_deref())
}

pub fn has_flag(args: &[Arg], key: &str) -> bool {
    args.iter().any(|a| a.key == key)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn simple_flag() { let args = vec!["--verbose".to_string()]; let p = parse(&args); assert!(has_flag(&p, "verbose")); }
    #[test] fn key_value_space() { let args = vec!["--name".to_string(), "alice".to_string()]; let p = parse(&args); assert_eq!(lookup(&p, "name"), Some("alice")); }
    #[test] fn key_value_eq() { let args = vec!["--name=bob".to_string()]; let p = parse(&args); assert_eq!(lookup(&p, "name"), Some("bob")); }
    #[test] fn short_flag() { let args = vec!["-v".to_string()]; let p = parse(&args); assert!(has_flag(&p, "v")); }
    #[test] fn positional() { let args = vec!["file.txt".to_string()]; let p = parse(&args); assert_eq!(p[0].key, "file.txt"); assert_eq!(p[0].value, None); }
}
