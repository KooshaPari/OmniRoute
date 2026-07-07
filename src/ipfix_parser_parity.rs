// Minimal IPFIX (RFC 7011) template + data record codec. Parses a single
// template record (set_id=2) and the first data record from a data set
// (set_id>=256). Variable-length fields carry a u8 length prefix. Does
// NOT parse the IPFIX message header or set header — feed it a body
// that begins right after those.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FieldSpec {
    pub element_id: u16,
    /// 0xFFFF means variable-length (u8 prefix + payload).
    pub field_length: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateRecord {
    pub template_id: u16,
    pub field_count: u16,
    pub fields: Vec<FieldSpec>,
}

/// Parse a single template record. `body` starts at the template body
/// (no set header). Returns the template and the number of bytes
/// consumed.
pub fn parse_template(body: &[u8]) -> Result<(TemplateRecord, usize), String> {
    if body.len() < 4 { return Err("ipfix: truncated template header".into()); }
    let template_id = u16::from_be_bytes([body[0], body[1]]);
    let field_count = u16::from_be_bytes([body[2], body[3]]);
    let mut i = 4usize;
    let mut fields = Vec::with_capacity(field_count as usize);
    for _ in 0..field_count {
        if i + 4 > body.len() { return Err("ipfix: truncated field spec".into()); }
        let eid = u16::from_be_bytes([body[i], body[i+1]]);
        let len = u16::from_be_bytes([body[i+2], body[i+3]]);
        i += 4;
        fields.push(FieldSpec { element_id: eid, field_length: len });
    }
    Ok((TemplateRecord { template_id, field_count, fields }, i))
}

/// Parse a single data record. `specs` is the matching template's
/// field list. Returns `(element_id, payload)` pairs in template order.
pub fn parse_data<'a>(body: &'a [u8], specs: &[FieldSpec]) -> Result<Vec<(u16, &'a [u8])>, String> {
    let mut out = Vec::with_capacity(specs.len());
    let mut i = 0usize;
    for spec in specs {
        let n: usize = if spec.field_length == 0xFFFF {
            if i >= body.len() { return Err("ipfix: missing varlen prefix".into()); }
            let l = body[i] as usize;
            if l == 0 { return Err("ipfix: zero varlen".into()); }
            i += 1;
            l
        } else {
            spec.field_length as usize
        };
        if i + n > body.len() { return Err("ipfix: truncated field".into()); }
        out.push((spec.element_id, &body[i..i+n]));
        i += n;
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn parse_template_basic() {
        // template_id=258, 2 fields: (8, 4) and (12, 4)
        let body = [
            0x01, 0x02, 0x00, 0x02,
            0x00, 0x08, 0x00, 0x04,
            0x00, 0x0c, 0x00, 0x04,
        ];
        let (t, used) = parse_template(&body).unwrap();
        assert_eq!(t.template_id, 258);
        assert_eq!(t.field_count, 2);
        assert_eq!(t.fields[0].element_id, 8);
        assert_eq!(t.fields[1].field_length, 4);
        assert_eq!(used, body.len());
    }
    #[test] fn parse_data_fixed() {
        let body = [10, 0, 0, 1, 10, 0, 0, 2];
        let specs = vec![
            FieldSpec { element_id: 8, field_length: 4 },
            FieldSpec { element_id: 12, field_length: 4 },
        ];
        let r = parse_data(&body, &specs).unwrap();
        assert_eq!(r.len(), 2);
        assert_eq!(r[0].0, 8);
        assert_eq!(r[0].1, &[10, 0, 0, 1]);
        assert_eq!(r[1].1, &[10, 0, 0, 2]);
    }
    #[test] fn parse_data_varlen() {
        let body = [0x05, b'h', b'e', b'l', b'l', b'o'];
        let specs = vec![FieldSpec { element_id: 0xc0, field_length: 0xffff }];
        let r = parse_data(&body, &specs).unwrap();
        assert_eq!(r[0].1, b"hello");
    }
    #[test] fn parse_data_truncated() {
        let body = [1, 2];
        let specs = vec![FieldSpec { element_id: 8, field_length: 4 }];
        assert!(parse_data(&body, &specs).is_err());
    }
    #[test] fn parse_template_truncated() {
        let body = [0, 1, 0, 1, 0, 8]; // 1 field spec but only 2 bytes
        assert!(parse_template(&body).is_err());
    }
}
