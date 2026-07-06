#[derive(Debug, PartialEq, Clone)]
pub enum Value {
    Nil,
    Bool(bool),
    Int(i64),
    UInt(u64),
    Float(f64),
    Str(String),
    Bin(Vec<u8>),
    Array(Vec<Value>),
    Map(Vec<(Value, Value)>),
}

pub fn encode(v: &Value, out: &mut Vec<u8>) {
    match v {
        Value::Nil => out.push(0xc0),
        Value::Bool(false) => out.push(0xc2),
        Value::Bool(true) => out.push(0xc3),
        Value::Int(i) if *i >= 0 && *i < 128 => out.push(*i as u8),
        Value::Int(i) if *i >= -32 && *i < 0 => out.push(*i as u8),
        Value::Int(i) if *i >= -32768 && *i < 32768 => { out.push(0xd1); let b = i.to_be_bytes(); out.extend_from_slice(&b[6..]); }
        Value::Int(i) if *i >= -2147483648 && *i < 2147483648 => { out.push(0xd2); let b = i.to_be_bytes(); out.extend_from_slice(&b[4..]); }
        Value::Int(i) => { out.push(0xd3); out.extend_from_slice(&i.to_be_bytes()); }
        Value::UInt(u) if *u < 128 => { out.push(*u as u8); }
        Value::UInt(u) if *u < 256 => { out.push(0xcc); out.push(*u as u8); }
        Value::UInt(u) if *u < 65536 => { out.push(0xcd); out.extend_from_slice(&u.to_be_bytes()[6..]); }
        Value::UInt(u) if *u < 4_294_967_296 => { out.push(0xce); out.extend_from_slice(&u.to_be_bytes()[4..]); }
        Value::UInt(u) => { out.push(0xcf); out.extend_from_slice(&u.to_be_bytes()); }
        Value::Float(f) => { out.push(0xcb); out.extend_from_slice(&f.to_be_bytes()); }
        Value::Str(s) => { encode_str_header(s.len(), out); out.extend_from_slice(s.as_bytes()); }
        Value::Bin(b) => { encode_bin_header(b.len(), out); out.extend_from_slice(b); }
        Value::Array(items) => {
            if items.len() < 16 { out.push(0x90 | items.len() as u8); }
            else if items.len() < 65536 { out.push(0xdc); out.extend_from_slice(&(items.len() as u16).to_be_bytes()); }
            else { out.push(0xdd); out.extend_from_slice(&(items.len() as u32).to_be_bytes()); }
            for item in items { encode(item, out); }
        }
        Value::Map(entries) => {
            if entries.len() < 16 { out.push(0x80 | entries.len() as u8); }
            else if entries.len() < 65536 { out.push(0xde); out.extend_from_slice(&(entries.len() as u16).to_be_bytes()); }
            else { out.push(0xdf); out.extend_from_slice(&(entries.len() as u32).to_be_bytes()); }
            for (k, v) in entries { encode(k, out); encode(v, out); }
        }
    }
}
fn encode_str_header(len: usize, out: &mut Vec<u8>) {
    if len < 32 { out.push(0xa0 | len as u8); }
    else if len < 256 { out.push(0xd9); out.push(len as u8); }
    else if len < 65536 { out.push(0xda); out.extend_from_slice(&(len as u16).to_be_bytes()); }
    else { out.push(0xdb); out.extend_from_slice(&(len as u32).to_be_bytes()); }
}
fn encode_bin_header(len: usize, out: &mut Vec<u8>) {
    if len < 256 { out.push(0xc4); out.push(len as u8); }
    else if len < 65536 { out.push(0xc5); out.extend_from_slice(&(len as u16).to_be_bytes()); }
    else { out.push(0xc6); out.extend_from_slice(&(len as u32).to_be_bytes()); }
}
pub fn decode(input: &[u8]) -> Result<(Value, usize), String> {
    if input.is_empty() { return Err("empty".into()); }
    let first = input[0];
    match first {
        0xc0 => Ok((Value::Nil, 1)),
        0xc2 => Ok((Value::Bool(false), 1)),
        0xc3 => Ok((Value::Bool(true), 1)),
        0xc4 => {
            if input.len() < 2 { return Err("bin too short".into()); }
            let len = input[1] as usize;
            if input.len() < 2 + len { return Err("bin truncated".into()); }
            Ok((Value::Bin(input[2..2+len].to_vec()), 2 + len))
        }
        0xcb => {
            if input.len() < 9 { return Err("float too short".into()); }
            let bytes: [u8; 8] = input[1..9].try_into().map_err(|_| "bad float".to_string())?;
            Ok((Value::Float(f64::from_be_bytes(bytes)), 9))
        }
        0xcc => { if input.len() < 2 { return Err("uint8 too short".into()); } Ok((Value::UInt(input[1] as u64), 2)) }
        0xcd => {
            if input.len() < 3 { return Err("uint16 too short".into()); }
            Ok((Value::UInt(u16::from_be_bytes([input[1], input[2]]) as u64), 3))
        }
        0xce => {
            if input.len() < 5 { return Err("uint32 too short".into()); }
            Ok((Value::UInt(u32::from_be_bytes([input[1], input[2], input[3], input[4]]) as u64), 5))
        }
        0xcf => {
            if input.len() < 9 { return Err("uint64 too short".into()); }
            let u = u64::from_be_bytes(input[1..9].try_into().map_err(|_| "bad u64".to_string())?);
            Ok((Value::UInt(u), 9))
        }
        0xd0 => { if input.len() < 2 { return Err("int8 too short".into()); } Ok((Value::Int(input[1] as i8 as i64), 2)) }
        0xd1 => {
            if input.len() < 3 { return Err("int16 too short".into()); }
            Ok((Value::Int(i16::from_be_bytes([input[1], input[2]]) as i64), 3))
        }
        0xd2 => {
            if input.len() < 5 { return Err("int32 too short".into()); }
            Ok((Value::Int(i32::from_be_bytes([input[1], input[2], input[3], input[4]]) as i64), 5))
        }
        0xd3 => {
            if input.len() < 9 { return Err("int64 too short".into()); }
            let i = i64::from_be_bytes(input[1..9].try_into().map_err(|_| "bad i64".to_string())?);
            Ok((Value::Int(i), 9))
        }
        0xa0..=0xbf => decode_str(input, 1, (first & 0x1f) as usize),
        0xd9 => { if input.len() < 2 { return Err("str8 too short".into()); } decode_str(input, 2, input[1] as usize) }
        0xda => {
            if input.len() < 3 { return Err("str16 too short".into()); }
            decode_str(input, 3, u16::from_be_bytes([input[1], input[2]]) as usize)
        }
        0xdb => {
            if input.len() < 5 { return Err("str32 too short".into()); }
            decode_str(input, 5, u32::from_be_bytes([input[1], input[2], input[3], input[4]]) as usize)
        }
        0x90..=0x9f => decode_array(input, 1, (first & 0x0f) as usize),
        0xdc => {
            if input.len() < 3 { return Err("array16 too short".into()); }
            decode_array(input, 3, u16::from_be_bytes([input[1], input[2]]) as usize)
        }
        0xdd => {
            if input.len() < 5 { return Err("array32 too short".into()); }
            decode_array(input, 5, u32::from_be_bytes([input[1], input[2], input[3], input[4]]) as usize)
        }
        0x80..=0x8f => decode_map(input, 1, (first & 0x0f) as usize),
        0xde => {
            if input.len() < 3 { return Err("map16 too short".into()); }
            decode_map(input, 3, u16::from_be_bytes([input[1], input[2]]) as usize)
        }
        0xdf => {
            if input.len() < 5 { return Err("map32 too short".into()); }
            decode_map(input, 5, u32::from_be_bytes([input[1], input[2], input[3], input[4]]) as usize)
        }
        0x00..=0x7f => Ok((Value::Int(first as i64), 1)),
        0xe0..=0xff => Ok((Value::Int(first as i8 as i64), 1)),
        other => Err(format!("unsupported marker: 0x{:02x}", other)),
    }
}
fn decode_str(input: &[u8], start: usize, len: usize) -> Result<(Value, usize), String> {
    if input.len() < start + len { return Err("str truncated".into()); }
    let s = std::str::from_utf8(&input[start..start+len]).map_err(|_| "bad utf8".to_string())?.to_string();
    Ok((Value::Str(s), start + len))
}
fn decode_array(input: &[u8], mut pos: usize, len: usize) -> Result<(Value, usize), String> {
    let mut items = Vec::with_capacity(len);
    for _ in 0..len {
        let (v, next) = decode(&input[pos..])?;
        items.push(v);
        pos += next;
    }
    Ok((Value::Array(items), pos))
}
fn decode_map(input: &[u8], mut pos: usize, len: usize) -> Result<(Value, usize), String> {
    let mut entries = Vec::with_capacity(len);
    for _ in 0..len {
        let (k, next) = decode(&input[pos..])?;
        pos += next;
        let (v, next2) = decode(&input[pos..])?;
        pos += next2;
        entries.push((k, v));
    }
    Ok((Value::Map(entries), pos))
}
#[cfg(test)]
mod tests {
    use super::*;
    fn roundtrip(v: &Value) -> Value {
        let mut buf = Vec::new();
        encode(v, &mut buf);
        let (out, n) = decode(&buf).unwrap();
        assert_eq!(n, buf.len());
        out
    }
    #[test] fn nil() { assert_eq!(roundtrip(&Value::Nil), Value::Nil); }
    #[test] fn bools() { assert_eq!(roundtrip(&Value::Bool(true)), Value::Bool(true)); assert_eq!(roundtrip(&Value::Bool(false)), Value::Bool(false)); }
    #[test] fn pos_fixint() { assert_eq!(roundtrip(&Value::Int(5)), Value::Int(5)); }
    #[test] fn neg_fixint() { assert_eq!(roundtrip(&Value::Int(-5)), Value::Int(-5)); }
    #[test] fn int16() { assert_eq!(roundtrip(&Value::Int(1000)), Value::Int(1000)); assert_eq!(roundtrip(&Value::Int(-1000)), Value::Int(-1000)); }
    #[test] fn int32() { assert_eq!(roundtrip(&Value::Int(100000)), Value::Int(100000)); }
    #[test] fn int64() { assert_eq!(roundtrip(&Value::Int(i64::MAX)), Value::Int(i64::MAX)); }
    #[test] fn uint_small() { assert_eq!(roundtrip(&Value::UInt(200)), Value::UInt(200)); }
    #[test] fn uint64() { assert_eq!(roundtrip(&Value::UInt(u64::MAX)), Value::UInt(u64::MAX)); }
    #[test] fn float() {
        let v = Value::Float(3.14);
        let mut buf = Vec::new();
        encode(&v, &mut buf);
        let (out, _) = decode(&buf).unwrap();
        if let Value::Float(f) = out { assert_eq!(f, 3.14); } else { panic!(); }
    }
    #[test] fn str() { assert_eq!(roundtrip(&Value::Str("hello".into())), Value::Str("hello".into())); }
    #[test] fn str_long() { let s = "a".repeat(500); assert_eq!(roundtrip(&Value::Str(s.clone())), Value::Str(s)); }
    #[test] fn bin() { assert_eq!(roundtrip(&Value::Bin(vec![1, 2, 3, 4, 5])), Value::Bin(vec![1, 2, 3, 4, 5])); }
    #[test] fn array() { let v = Value::Array(vec![Value::Int(1), Value::Int(2), Value::Int(3)]); assert_eq!(roundtrip(&v), v); }
    #[test] fn array_nested() { let v = Value::Array(vec![Value::Int(1), Value::Array(vec![Value::Int(2)]), Value::Str("x".into())]); assert_eq!(roundtrip(&v), v); }
    #[test] fn map() { let v = Value::Map(vec![(Value::Str("a".into()), Value::Int(1)), (Value::Str("b".into()), Value::Int(2))]); assert_eq!(roundtrip(&v), v); }
    #[test] fn empty_array() { assert_eq!(roundtrip(&Value::Array(vec![])), Value::Array(vec![])); }
    #[test] fn empty_map() { assert_eq!(roundtrip(&Value::Map(vec![])), Value::Map(vec![])); }
}
