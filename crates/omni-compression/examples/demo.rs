use omni_compression::{compress, CompressRequest, Engine};

#[tokio::main]
async fn main() {
    let s = "In order to fully understand this, it is very important to be quite thorough and not miss anything that might be relevant due to the fact that there are many things at this point in time.";
    println!("INPUT ({} chars): {}\n", s.len(), s);

    for engine in [Engine::Rtk, Engine::Caveman, Engine::Aggressive] {
        let r = compress(CompressRequest { text: s, engine, target_ratio: None })
            .await
            .unwrap();
        println!("{:?} ({} -> {} tokens, ratio {:.2}):\n  {}\n",
            engine, r.original_tokens, r.compressed_tokens, r.ratio, r.text);
    }
}
