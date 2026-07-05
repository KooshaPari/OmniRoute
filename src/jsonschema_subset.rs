#[derive(Debug, PartialEq, Clone)]
pub enum JsValue {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<JsValue>),
    Obj(Vec<(String, JsValue)>),
}
impl JsValue {
    pub fn from_json(s: &str) -> Result<Self, String> {
        let mut p = Parser { s: s.as_bytes().to_vec(), i: 0 };
        p.skip_ws();
        let v = p.parse_value()?;
        p.skip_ws();
        if p.i < p.s.len() { return Err(format!("trailing data at byte {}", p.i)); }
        Ok(v)
    }
    fn type_name(&self) -> &'static str {
        match self {
            JsValue::Null => "null",
            JsValue::Bool(_) => "boolean",
            JsValue::Num(_) => "number",
            JsValue::Str(_) => "string",
            JsValue::Arr(_) => "array",
            JsValue::Obj(_) => "object",
        }
    }
    pub fn validate(&self, schema: &JsValue) -> Result<(), String> {
        if let JsValue::Obj(rules) = schema {
            if let Some((_, JsValue::Str(t))) = rules.iter().find(|(k, _)| k == "type") {
                if self.type_name() != t.as_str() {
                    return Err(format!("expected type {} got {}", t, self.type_name()));
                }
            }
            if let Some((_, JsValue::Obj(props))) = rules.iter().find(|(k, _)| k == "properties") {
                if let JsValue::Obj(obj) = self {
                    for (pk, pv) in props {
                        if let Some((_, av)) = obj.iter().find(|(k, _)| k == pk) {
                            av.validate(pv)?;
                        }
                    }
                }
            }
            if let Some((_, JsValue::Arr(required))) = rules.iter().find(|(k, _)| k == "required") {
                if let JsValue::Obj(obj) = self {
                    for r in required {
                        if let JsValue::Str(name) = r {
                            if !obj.iter().any(|(k, _)| k == name) {
                                return Err(format!("missing required field {}", name));
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }
}
struct Parser { s: Vec<u8>, i: usize }
impl Parser {
    fn skip_ws(&mut self) { while self.i < self.s.len() && self.s[self.i].is_ascii_whitespace() { self.i += 1; } }
    fn peek(&self) -> Option<u8> { self.s.get(self.i).copied() }
    fn parse_value(&mut self) -> Result<JsValue, String> {
        self.skip_ws();
        match self.peek() {
            Some(b'n') => { self.expect("null")?; Ok(JsValue::Null) }
            Some(b't') => { self.expect("true")?; Ok(JsValue::Bool(true)) }
            Some(b'f') => { self.expect("false")?; Ok(JsValue::Bool(false)) }
            Some(b'"') => Ok(JsValue::Str(self.parse_string()?)),
            Some(b'[') => self.parse_array(),
            Some(b'{') => self.parse_object(),
            Some(b'-') => Ok(JsValue::Num(self.parse_number()?)),
            Some(c) if c.is_ascii_digit() => Ok(JsValue::Num(self.parse_number()?)),
            _ => Err(format!("unexpected byte at {}", self.i)),
        }
    }
    fn expect(&mut self, lit: &str) -> Result<(), String> {
        for b in lit.bytes() {
            if self.peek() != Some(b) { return Err(format!("expected {} at {}", lit, self.i)); }
            self.i += 1;
        }
        Ok(())
    }
    fn parse_string(&mut self) -> Result<String, String> {
        self.i += 1;
        let mut out = String::new();
        while let Some(c) = self.peek() {
            if c == b'"' { self.i += 1; return Ok(out); }
            if c == b'\\' {
                self.i += 1;
                match self.peek() {
                    Some(b'"') => { out.push('"'); self.i += 1; }
                    Some(b'\\') => { out.push('\\'); self.i += 1; }
                    Some(b'n') => { out.push('\n'); self.i += 1; }
                    Some(b't') => { out.push('\t'); self.i += 1; }
                    _ => return Err(format!("bad escape at {}", self.i)),
                }
            } else {
                out.push(c as char);
                self.i += 1;
            }
        }
        Err("unterminated string".to_string())
    }
    fn parse_number(&mut self) -> Result<f64, String> {
        let start = self.i;
        if self.peek() == Some(b'-') { self.i += 1; }
        while let Some(c) = self.peek() {
            if c.is_ascii_digit() || c == b'.' || c == b'e' || c == b'E' || c == b'+' || c == b'-' {
                self.i += 1;
            } else { break; }
        }
        std::str::from_utf8(&self.s[start..self.i]).map_err(|_| "utf8".to_string())?
            .parse::<f64>().map_err(|e| e.to_string())
    }
    fn parse_array(&mut self) -> Result<JsValue, String> {
        self.i += 1;
        let mut arr = Vec::new();
        self.skip_ws();
        if self.peek() == Some(b']') { self.i += 1; return Ok(JsValue::Arr(arr)); }
        loop {
            arr.push(self.parse_value()?);
            self.skip_ws();
            match self.peek() {
                Some(b',') => { self.i += 1; }
                Some(b']') => { self.i += 1; return Ok(JsValue::Arr(arr)); }
                _ => return Err(format!("expected , or ] at {}", self.i)),
            }
        }
    }
    fn parse_object(&mut self) -> Result<JsValue, String> {
        self.i += 1;
        let mut obj = Vec::new();
        self.skip_ws();
        if self.peek() == Some(b'}') { self.i += 1; return Ok(JsValue::Obj(obj)); }
        loop {
            self.skip_ws();
            let k = self.parse_string()?;
            self.skip_ws();
            if self.peek() != Some(b':') { return Err(format!("expected : at {}", self.i)); }
            self.i += 1;
            let v = self.parse_value()?;
            obj.push((k, v));
            self.skip_ws();
            match self.peek() {
                Some(b',') => { self.i += 1; }
                Some(b'}') => { self.i += 1; return Ok(JsValue::Obj(obj)); }
                _ => return Err(format!("expected , or }} at {}", self.i)),
            }
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn parse_simple() {
        let v = JsValue::from_json(r#"{"name":"alice","age":30}"#).unwrap();
        if let JsValue::Obj(o) = v {
            assert_eq!(o.len(), 2);
            assert_eq!(o[0].0, "name");
        } else { panic!("expected object"); }
    }
    #[test] fn parse_arr() {
        let v = JsValue::from_json("[1,2,3]").unwrap();
        if let JsValue::Arr(a) = v { assert_eq!(a.len(), 3); } else { panic!(); }
    }
    #[test] fn validate_type_ok() {
        let v = JsValue::from_json(r#"{"name":"a"}"#).unwrap();
        let s = JsValue::from_json(r#"{"type":"object"}"#).unwrap();
        assert!(v.validate(&s).is_ok());
    }
    #[test] fn validate_type_fail() {
        let v = JsValue::from_json("123").unwrap();
        let s = JsValue::from_json(r#"{"type":"string"}"#).unwrap();
        assert!(v.validate(&s).is_err());
    }
    #[test] fn validate_required_missing() {
        let v = JsValue::from_json(r#"{"name":"a"}"#).unwrap();
        let s = JsValue::from_json(r#"{"required":["name","age"]}"#).unwrap();
        assert!(v.validate(&s).is_err());
    }
    #[test] fn validate_required_present() {
        let v = JsValue::from_json(r#"{"name":"a","age":1}"#).unwrap();
        let s = JsValue::from_json(r#"{"required":["name","age"]}"#).unwrap();
        assert!(v.validate(&s).is_ok());
    }
    #[test] fn parse_nested() {
        let v = JsValue::from_json(r#"{"a":{"b":[1,2]}}"#).unwrap();
        if let JsValue::Obj(o) = v {
            if let JsValue::Obj(inner) = &o[0].1 {
                if let JsValue::Arr(a) = &inner[0].1 {
                    assert_eq!(a.len(), 2);
                    return;
                }
            }
        }
        panic!("nested structure mismatch");
    }
}
