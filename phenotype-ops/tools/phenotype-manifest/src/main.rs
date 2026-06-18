//! phenotype-manifest — Attestation manifest generator and validator
//!
//! Generates signed manifests for pre-push hooks and validates them in CI.

use clap::{Parser, Subcommand};
use std::path::PathBuf;

mod cli;
mod crypto;
mod generate;
mod manifest;
mod pillar;
mod schema;
mod verify;

use cli::{GenerateArgs, VerifyArgs, ShowArgs};
use generate::generate_manifest;
use verify::verify_manifest;

#[derive(Parser)]
#[command(name = "phenotype-manifest", version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Enable verbose output
    #[arg(short, long, global = true)]
    verbose: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate a signed attestation manifest
    Generate(GenerateArgs),

    /// Verify a signed attestation manifest
    Verify(VerifyArgs),

    /// Show manifest contents (human-readable)
    Show(ShowArgs),

    /// Run a specific pillar check locally
    RunPillar {
        /// Pillar to run (quality|security|perf|compliance|docs)
        pillar: String,

        /// Output format (json|human)
        #[arg(short, long, default_value = "human")]
        format: String,
    },

    /// Initialize repo with manifest key and lefthook
    Init {
        /// Path to Ed25519 private key
        #[arg(long, default_value = "~/.ssh/manifest")]
        key: PathBuf,

        /// Generate new key if missing
        #[arg(long)]
        generate_key: bool,
    },
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    if cli.verbose {
        tracing_subscriber::fmt()
            .with_env_filter("debug")
            .init();
    } else {
        tracing_subscriber::fmt()
            .with_env_filter("info")
            .init();
    }

    match cli.command {
        Commands::Generate(args) => generate_manifest(args),
        Commands::Verify(args) => verify_manifest(args),
        Commands::Show(args) => show_manifest(args),
        Commands::RunPillar { pillar, format } => run_pillar(&pillar, &format),
        Commands::Init { key, generate_key } => init_repo(key, generate_key),
    }
}

fn show_manifest(args: ShowArgs) -> anyhow::Result<()> {
    let content = std::fs::read_to_string(&args.manifest)?;
    let manifest: manifest::Manifest = serde_json::from_str(&content)?;

    if args.json {
        println!("{}", serde_json::to_string_pretty(&manifest)?);
    } else {
        println!("{}", manifest.format_human());
    }
    Ok(())
}

fn run_pillar(pillar: &str, format: &str) -> anyhow::Result<()> {
    use pillar::Pillar;
    let pillar_enum = pillar.parse::<Pillar>()?;
    let result = pillar_enum.run_checks()?;

    if format == "json" {
        println!("{}", serde_json::to_string_pretty(&result)?);
    } else {
        println!("{}", result.format_human());
    }
    Ok(())
}

fn init_repo(key_path: PathBuf, generate_key: bool) -> anyhow::Result<()> {
    use std::os::unix::fs::PermissionsExt;

    // Expand tilde
    let key_path = shellexpand::tilde(&key_path.to_string_lossy()).into_owned();
    let key_path = PathBuf::from(key_path);

    if generate_key || !key_path.exists() {
        println!("🔑 Generating Ed25519 key at {}", key_path.display());
        let mut csprng = rand::rngs::OsRng;
        let signing_key = ed25519_dalek::SigningKey::generate(&mut csprng);

        std::fs::create_dir_all(key_path.parent().unwrap())?;
        std::fs::write(&key_path, signing_key.to_bytes())?;
        std::fs::set_permissions(&key_path, std::fs::Permissions::from_mode(0o600))?;

        let verifying_key = signing_key.verifying_key();
        let pubkey_path = key_path.with_extension("pub");
        std::fs::write(&pubkey_path, verifying_key.to_bytes())?;
        println!("✅ Key pair generated: {} + {}", key_path.display(), pubkey_path.display());
    }

    // Copy lefthook.yml from phenotype-ops
    let lefthook_src = std::env::current_dir()?.join("../../governance/lefthook.yml");
    let lefthook_dst = std::env::current_dir()?.join("lefthook.yml");
    if lefthook_src.exists() {
        std::fs::copy(&lefthook_src, &lefthook_dstook_dst)?;
        println!("✅ Copied lefthook.yml");
    }

    println!("📋 Next steps:");
    println!("   1. lefthook install");
    println!("   2. Add public key to .github/manifest.pubkey.pem");
    println!("   3. git push (will generate manifest)");

    Ok(())
}