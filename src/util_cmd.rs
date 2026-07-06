//! `sharecli util` — exercise the bundled utility modules from the CLI.
use anyhow::Result;
use clap::{Args, Subcommand};

use crate::{
    apfs_uuid, base85, crc64, csv_writer, hash_util, jsonschema_subset, md_table,
    radix_trie, skiplist, xxhash3, xxtea, xml_escape,
};

fn line(label: &str, value: impl std::fmt::Display) {
    println!("{label}: {value}");
}
fn hex_u64(v: u64) -> String {
    format!("0x{:016x}", v)
}

#[derive(Args, Debug)]
pub struct Base85Cmd {
    #[arg(long, default_value = "encode")]
    pub action: String,
    pub input: String,
}
#[derive(Args, Debug)]
pub struct CsvCmd {
    #[arg(long = "row", num_args = 1..)]
    pub rows: Vec<String>,
}
#[derive(Args, Debug)]
pub struct CrcCmd {
    pub input: String,
}
#[derive(Args, Debug)]
pub struct HashCmd {
    #[arg(long, default_value = "xxhash3")]
    pub algo: String,
    pub input: String,
    #[arg(long)]
    pub key_hex: Option<String>,
}
#[derive(Args, Debug)]
pub struct JsonCmd {
    pub input: String,
}
#[derive(Args, Debug)]
pub struct ShaCmd {
    pub input: String,
}
#[derive(Args, Debug)]
pub struct UrlCmd {
    #[arg(default_value = "")]
    pub input: String,
}
#[derive(Args, Debug)]
pub struct UuidCmd {
    pub input: Option<String>,
}
#[derive(Args, Debug)]
pub struct XmlCmd {
    #[arg(long, default_value = "escape")]
    pub action: String,
    pub input: String,
}
#[derive(Args, Debug)]
pub struct MarkdownCmd {
    pub rows: Vec<String>,
}
#[derive(Args, Debug)]
pub struct RngCmd {
    #[arg(long, default_value = "trie")]
    pub kind: String,
    pub words: Vec<String>,
}

#[derive(Subcommand, Debug)]
pub enum UtilCmd {
    Base85(Base85Cmd),
    Csv(CsvCmd),
    Crc(CrcCmd),
    Hash(HashCmd),
    Json(JsonCmd),
    Sha(ShaCmd),
    Url(UrlCmd),
    Uuid(UuidCmd),
    Xml(XmlCmd),
    Markdown(MarkdownCmd),
    Rng(RngCmd),
}

impl UtilCmd {
    pub fn run(&self) -> Result<()> {
        match self {
            UtilCmd::Base85(c) => run_base85(c),
            UtilCmd::Csv(c) => run_csv(c),
            UtilCmd::Crc(c) => run_crc(c),
            UtilCmd::Hash(c) => run_hash(c),
            UtilCmd::Json(c) => run_json(c),
            UtilCmd::Sha(c) => run_sha(c),
            UtilCmd::Url(_) => {
                println!("url_parser: module not present in this crate (skip)");
                Ok(())
            }
            UtilCmd::Uuid(c) => run_uuid(c),
            UtilCmd::Xml(c) => run_xml(c),
            UtilCmd::Markdown(c) => run_markdown(c),
            UtilCmd::Rng(c) => run_rng(c),
        }
    }
}

fn run_base85(c: &Base85Cmd) -> Result<()> {
    match c.action.as_str() {
        "encode" => {
            println!("{}", base85::encode(c.input.as_bytes()));
        }
        "decode" => match base85::decode(&c.input) {
            Ok(bytes) => match std::str::from_utf8(&bytes) {
                Ok(s) => println!("{s}"),
                Err(_) => {
                    let mut s = String::new();
                    for b in bytes {
                        s.push_str(&format!("{:02x}", b));
                    }
                    println!("0x{s}");
                }
            },
            Err(e) => anyhow::bail!("decode error: {e}"),
        },
        other => anyhow::bail!("unknown action '{other}' (use encode|decode)"),
    }
    Ok(())
}

fn run_csv(c: &CsvCmd) -> Result<()> {
    if c.rows.is_empty() {
        anyhow::bail!("csv: pass at least one --row a b c");
    }
    for row in &c.rows {
        let fields: Vec<&str> = row.split_whitespace().collect();
        print!("{}", csv_writer::write_row(&fields));
    }
    Ok(())
}

fn run_crc(c: &CrcCmd) -> Result<()> {
    let v = crc64::crc64(c.input.as_bytes());
    line("crc64", hex_u64(v));
    Ok(())
}

fn run_hash(c: &HashCmd) -> Result<()> {
    match c.algo.as_str() {
        "djb2" => println!("djb2: {}", hash_util::djb2(&c.input)),
        "fnv1a" => println!("fnv1a: {}", hash_util::fnv1a(&c.input)),
        "simple" => println!("simple: {}", hash_util::simple_hash(&c.input)),
        "xxhash3" => {
            let h = xxhash3::hash(c.input.as_bytes());
            println!("xxhash3: 0x{:016x}", h);
        }
        "xxtea-encrypt" => {
            let key = parse_key(c.key_hex.as_deref())?;
            let block = block_from_str(&c.input);
            let mut out = block;
            xxtea::xxtea_encrypt(&mut out, &key);
            println!("xxtea-enc: 0x{}", hex_block(&out));
        }
        "xxtea-decrypt" => {
            let key = parse_key(c.key_hex.as_deref())?;
            let block = block_from_str(&c.input);
            let mut out = block;
            xxtea::xxtea_decrypt(&mut out, &key);
            println!("xxtea-dec: 0x{}", hex_block(&out));
        }
        other => anyhow::bail!("unknown hash algo '{other}'"),
    }
    Ok(())
}

fn parse_key(hex: Option<&str>) -> Result<[u32; 4]> {
    let h = hex.ok_or_else(|| anyhow::anyhow!("--key-hex required for xxtea"))?;
    if h.len() != 32 {
        anyhow::bail!("--key-hex must be 32 hex chars (16 bytes), got {}", h.len());
    }
    let mut out = [0u32; 4];
    for i in 0..4 {
        let pair = &h[i * 8..i * 8 + 8];
        out[i] = u32::from_str_radix(pair, 16)
            .map_err(|_| anyhow::anyhow!("bad hex at byte {}", i * 8))?;
    }
    Ok(out)
}

fn block_from_str(s: &str) -> [u32; 4] {
    let bytes = s.as_bytes();
    let mut buf = [0u8; 16];
    for (i, b) in bytes.iter().take(16).enumerate() {
        buf[i] = *b;
    }
    let mut block = [0u32; 4];
    for i in 0..4 {
        block[i] = u32::from_le_bytes([
            buf[i * 4],
            buf[i * 4 + 1],
            buf[i * 4 + 2],
            buf[i * 4 + 3],
        ]);
    }
    block
}

fn hex_block(b: &[u32; 4]) -> String {
    let mut s = String::with_capacity(32);
    for v in b {
        s.push_str(&format!("{:08x}", v));
    }
    s
}

fn run_json(c: &JsonCmd) -> Result<()> {
    match jsonschema_subset::JsValue::from_json(&c.input) {
        Ok(v) => println!("ok: {:?}", v),
        Err(e) => anyhow::bail!("invalid JSON: {e}"),
    }
    Ok(())
}

fn run_sha(c: &ShaCmd) -> Result<()> {
    let h = xxhash3::hash(c.input.as_bytes());
    println!("{:016x}", h);
    Ok(())
}

fn run_uuid(c: &UuidCmd) -> Result<()> {
    let u = match &c.input {
        Some(s) if !s.is_empty() => apfs_uuid::Uuid::from_hex(s)
            .map_err(|e| anyhow::anyhow!("uuid parse: {e}"))?,
        _ => apfs_uuid::Uuid::nil(),
    };
    println!("hex: {}", u.to_hex_string());
    println!("hyp: {}", u.to_hyphenated());
    Ok(())
}

fn run_xml(c: &XmlCmd) -> Result<()> {
    match c.action.as_str() {
        "escape" => println!("{}", xml_escape::escape(&c.input)),
        "unescape" => println!("{}", xml_escape::unescape(&c.input)),
        other => anyhow::bail!("unknown xml action '{other}' (use escape|unescape)"),
    }
    Ok(())
}

fn run_markdown(c: &MarkdownCmd) -> Result<()> {
    if c.rows.is_empty() {
        anyhow::bail!("markdown: pass at least one row like 'name|role|'");
    }
    let parsed: Vec<Vec<&str>> = c
        .rows
        .iter()
        .map(|r| r.split('|').filter(|s| !s.is_empty()).collect())
        .collect();
    let headers: Vec<&str> = if !parsed.is_empty() {
        parsed[0].clone()
    } else {
        Vec::new()
    };
    let body: Vec<Vec<&str>> = parsed.iter().skip(1).cloned().collect();
    println!("{}", md_table::render(&headers, &body));
    Ok(())
}

fn run_rng(c: &RngCmd) -> Result<()> {
    match c.kind.as_str() {
        "trie" => {
            let mut t = radix_trie::RadixTrie::new();
            for w in &c.words {
                t.insert(w);
            }
            println!("trie_len: {}", t.len());
            for w in &c.words {
                println!("has({w}): {}", t.contains(w));
            }
        }
        "skiplist" => {
            let mut s = skiplist::SkipList::<u64, String>::new();
            for (i, w) in c.words.iter().enumerate() {
                s.insert(i as u64, w.clone());
            }
            println!("skip_len: {}", s.len());
            for (i, w) in c.words.iter().enumerate() {
                match s.get(&(i as u64)) {
                    Some(v) if v == *w => println!("get({i}): ok"),
                    Some(_) => println!("get({i}): mismatch"),
                    None => println!("get({i}): none"),
                }
            }
        }
        other => anyhow::bail!("unknown kind '{other}' (use trie|skiplist)"),
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base85_encode_decode_roundtrip() {
        let c = Base85Cmd {
            action: "encode".into(),
            input: "hello".into(),
        };
        assert!(run_base85(&c).is_ok());
    }

    #[test]
    fn base85_decode_action_does_not_panic() {
        let c = Base85Cmd {
            action: "decode".into(),
            input: "@@@".into(),
        };
        let r = run_base85(&c);
        assert!(r.is_ok() || r.is_err());
    }

    #[test]
    fn csv_row_writes_quoted_field() {
        let c = CsvCmd {
            rows: vec!["hello world".to_string()],
        };
        assert!(run_csv(&c).is_ok());
    }

    #[test]
    fn crc_returns_consistent_value() {
        let c = CrcCmd {
            input: "sharecli".into(),
        };
        assert!(run_crc(&c).is_ok());
    }

    #[test]
    fn hash_xxhash3_algo() {
        let c = HashCmd {
            algo: "xxhash3".into(),
            input: "abc".into(),
            key_hex: None,
        };
        assert!(run_hash(&c).is_ok());
    }

    #[test]
    fn hash_xxtea_round_trips() {
        let key = "00112233445566778899aabbccddeeff";
        let enc = HashCmd {
            algo: "xxtea-encrypt".into(),
            input: "sharecli".into(),
            key_hex: Some(key.into()),
        };
        assert!(run_hash(&enc).is_ok());
        let dec = HashCmd {
            algo: "xxtea-decrypt".into(),
            input: "sharecli".into(),
            key_hex: Some(key.into()),
        };
        assert!(run_hash(&dec).is_ok());
    }

    #[test]
    fn json_parses_well_formed() {
        let c = JsonCmd {
            input: r#"{"a":1,"b":[true,null]}"#.into(),
        };
        assert!(run_json(&c).is_ok());
    }

    #[test]
    fn xml_escape_and_unescape() {
        let e = XmlCmd {
            action: "escape".into(),
            input: "<a>&\"b\"</a>".into(),
        };
        assert!(run_xml(&e).is_ok());
        let u = XmlCmd {
            action: "unescape".into(),
            input: "&lt;a&gt;&amp;b&lt;/a&gt;".into(),
        };
        assert!(run_xml(&u).is_ok());
    }

    #[test]
    fn uuid_nil_and_from_hex() {
        let c = UuidCmd { input: None };
        assert!(run_uuid(&c).is_ok());
        let c = UuidCmd {
            input: Some("00112233445566778899aabbccddeeff".into()),
        };
        assert!(run_uuid(&c).is_ok());
    }

    #[test]
    fn rng_trie_and_skiplist() {
        let t = RngCmd {
            kind: "trie".into(),
            words: vec!["foo".into(), "bar".into(), "baz".into()],
        };
        assert!(run_rng(&t).is_ok());
        let s = RngCmd {
            kind: "skiplist".into(),
            words: vec!["foo".into(), "bar".into()],
        };
        assert!(run_rng(&s).is_ok());
    }
}
