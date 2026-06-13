use anyhow::Result;
use clap::{Arg, Command};
use kwality_runtime_validator::{Codebase, RuntimeConfig, RuntimeValidator};
use std::fs;
use std::path::PathBuf;
use tracing::{info, Level};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt().with_max_level(Level::INFO).init();

    let matches = Command::new("kwality-runtime")
        .version(env!("CARGO_PKG_VERSION"))
        .about("Kwality Runtime Validation Engine")
        .arg(
            Arg::new("config")
                .short('c')
                .long("config")
                .value_name("FILE")
                .help("Configuration file path")
                .default_value("config.json"),
        )
        .arg(
            Arg::new("codebase")
                .short('i')
                .long("input")
                .value_name("FILE")
                .help("Codebase JSON file to validate")
                .required(true),
        )
        .arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .value_name("FILE")
                .help("Output file for validation results")
                .default_value("validation_results.json"),
        )
        .get_matches();

    // Load configuration
    let config_path = matches.get_one::<String>("config").unwrap();
    let config = if PathBuf::from(config_path).exists() {
        let config_str = fs::read_to_string(config_path)?;
        serde_json::from_str(&config_str)?
    } else {
        info!("Config file not found, using default configuration");
        RuntimeConfig::default()
    };

    // Load codebase
    let codebase_path = matches.get_one::<String>("codebase").unwrap();
    let codebase_str = fs::read_to_string(codebase_path)?;
    let codebase: Codebase = serde_json::from_str(&codebase_str)?;

    info!(
        codebase_id = %codebase.id,
        codebase_name = %codebase.name,
        file_count = codebase.files.len(),
        "Starting runtime validation"
    );

    // Initialize validator
    let validator = RuntimeValidator::new(config).await?;

    // Run validation
    let result = validator.validate(&codebase).await?;

    // Save results
    let output_path = matches.get_one::<String>("output").unwrap();
    let result_json = serde_json::to_string_pretty(&result)?;
    fs::write(output_path, result_json)?;

    info!(
        validation_id = %result.validation_id,
        status = ?result.status,
        overall_score = result.overall_score,
        findings_count = result.findings.len(),
        output_file = output_path,
        "Runtime validation completed"
    );

    // Print summary
    println!("🔍 Runtime Validation Results");
    println!("═══════════════════════════════");
    println!("📊 Overall Score: {:.1}/100", result.overall_score);
    println!("⚡ Status: {:?}", result.status);
    println!("🔍 Findings: {}", result.findings.len());
    println!("💡 Recommendations: {}", result.recommendations.len());

    if let Some(duration) = result.duration {
        println!("⏱️  Duration: {:.2}s", duration.as_secs_f64());
    }

    if !result.findings.is_empty() {
        println!("\n🚨 Key Findings:");
        for finding in result.findings.iter().take(5) {
            println!("  • {} ({:?})", finding.title, finding.severity);
        }
    }

    if !result.recommendations.is_empty() {
        println!("\n💡 Top Recommendations:");
        for rec in result.recommendations.iter().take(3) {
            println!("  • {} ({:?})", rec.title, rec.priority);
        }
    }

    println!("\n📄 Full results saved to: {output_path}");

    Ok(())
}
