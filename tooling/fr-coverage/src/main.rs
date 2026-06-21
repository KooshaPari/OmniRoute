// SPDX-License-Identifier: MIT OR Apache-2.0

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use regex::Regex;
use walkdir::WalkDir;
use anyhow::{anyhow, Result};

fn main() -> Result<()> {
    let repo_root = find_repo_root()?;

    // Parse FR doc to extract all FRs and descriptions
    let frs = parse_functional_requirements(&repo_root)?;

    // Scan crates and apps for test traces
    let mut traces = BTreeMap::new();
    let mut orphan_tests = Vec::new();

    scan_crate_traces(&repo_root, &frs, &mut traces, &mut orphan_tests)?;
    scan_swift_traces(&repo_root, &frs, &mut traces, &mut orphan_tests)?;

    // Build matrix
    let covered = traces.len();
    let missing: Vec<_> = frs.iter()
        .filter(|(fr_id, _)| !traces.contains_key(*fr_id))
        .map(|(id, desc)| (id.clone(), desc.clone()))
        .collect();

    let matrix_content = generate_matrix(&frs, &traces, &orphan_tests);
    let matrix_path = repo_root.join("docs/reference/fr_coverage_matrix.md");
    fs::create_dir_all(matrix_path.parent().unwrap())?;
    fs::write(&matrix_path, matrix_content)?;

    // Summary
    let total = frs.len();
    let missing_count = missing.len();
    let orphan_count = orphan_tests.len();

    println!("=== FR Coverage Report ===");
    println!("Total FRs: {}", total);
    println!("Covered: {}", covered);
    println!("Missing: {}", missing_count);
    println!("Orphan tests: {}", orphan_count);

    if missing_count > 0 {
        println!("\nMissing FRs:");
        for (id, desc) in &missing {
            println!("  - {}: {}", id, desc);
        }
    }

    if orphan_count > 0 {
        println!("\nOrphan tests (reference non-existent FRs):");
        for (file, frs_ref) in &orphan_tests {
            println!("  - {}: {}", file, frs_ref.join(", "));
        }
    }

    println!("\nMatrix written to: {}", matrix_path.display());

    // Exit non-zero if there are gaps
    if missing_count > 0 || orphan_count > 0 {
        std::process::exit(1);
    }

    Ok(())
}

fn find_repo_root() -> Result<PathBuf> {
    let current = std::env::current_dir()?;
    let mut path = current.clone();
    loop {
        if path.join("FUNCTIONAL_REQUIREMENTS.md").exists() {
            return Ok(path);
        }
        if !path.pop() {
            return Err(anyhow!("FocalPoint repo root not found"));
        }
    }
}

fn parse_functional_requirements(repo_root: &PathBuf) -> Result<BTreeMap<String, String>> {
    let fr_path = repo_root.join("FUNCTIONAL_REQUIREMENTS.md");
    let content = fs::read_to_string(&fr_path)?;

    let mut frs = BTreeMap::new();

    // Regex to match `- **FR-XXXX-NNN** — Description.`
    let re = Regex::new(r#"- \*\*(FR-[A-Z]+-\d+)\*\* — ([^\n]+)"#)?;

    for cap in re.captures_iter(&content) {
        let fr_id = cap[1].to_string();
        let desc = cap[2].trim().to_string();
        frs.insert(fr_id, desc);
    }

    Ok(frs)
}

fn scan_crate_traces(
    repo_root: &PathBuf,
    frs: &BTreeMap<String, String>,
    traces: &mut BTreeMap<String, Vec<String>>,
    orphan_tests: &mut Vec<(String, Vec<String>)>,
) -> Result<()> {
    let crates_path = repo_root.join("crates");
    let fr_re = Regex::new(r"Traces to: (FR-[A-Z]+-\d+(?:, FR-[A-Z]+-\d+)*)")?;

    for entry in WalkDir::new(&crates_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "rs"))
    {
        let content = match fs::read_to_string(entry.path()) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let file_display = entry.path().display().to_string();

        for cap in fr_re.captures_iter(&content) {
            let fr_str = &cap[1];
            for fr_id in fr_str.split(", ") {
                let fr_id = fr_id.trim().to_string();

                if !frs.contains_key(&fr_id) {
                    orphan_tests.push((file_display.clone(), vec![fr_id.clone()]));
                } else {
                    traces.entry(fr_id).or_insert_with(Vec::new)
                        .push(file_display.clone());
                }
            }
        }
    }

    Ok(())
}

fn scan_swift_traces(
    repo_root: &PathBuf,
    frs: &BTreeMap<String, String>,
    traces: &mut BTreeMap<String, Vec<String>>,
    orphan_tests: &mut Vec<(String, Vec<String>)>,
) -> Result<()> {
    let apps_path = repo_root.join("apps/ios/FocalPoint");
    if !apps_path.exists() {
        return Ok(());
    }

    let fr_re = Regex::new(r"Traces to: (FR-[A-Z]+-\d+(?:, FR-[A-Z]+-\d+)*)")?;

    for entry in WalkDir::new(&apps_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "swift"))
    {
        let content = match fs::read_to_string(entry.path()) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let file_display = entry.path().display().to_string();

        for cap in fr_re.captures_iter(&content) {
            let fr_str = &cap[1];
            for fr_id in fr_str.split(", ") {
                let fr_id = fr_id.trim().to_string();

                if !frs.contains_key(&fr_id) {
                    orphan_tests.push((file_display.clone(), vec![fr_id.clone()]));
                } else {
                    traces.entry(fr_id).or_insert_with(|| Vec::new())
                        .push(file_display.clone());
                }
            }
        }
    }

    Ok(())
}

fn generate_matrix(
    frs: &BTreeMap<String, String>,
    traces: &BTreeMap<String, Vec<String>>,
    orphan_tests: &[(String, Vec<String>)],
) -> String {
    let mut output = String::new();
    output.push_str("# FR-to-Test Traceability Matrix\n\n");

    // Summary
    let total = frs.len();
    let covered = traces.len();
    let missing = total - covered;
    output.push_str(&format!("## Summary\n\n"));
    output.push_str(&format!("- **Total FRs:** {}\n", total));
    output.push_str(&format!("- **Covered (≥1 test):** {}\n", covered));
    output.push_str(&format!("- **Missing (0 tests):** {}\n", missing));
    output.push_str(&format!("- **Orphan tests:** {}\n\n", orphan_tests.len()));

    // Matrix table
    output.push_str("## Coverage Matrix\n\n");
    output.push_str("| FR ID | Description | Test Files | Status |\n");
    output.push_str("|-------|-------------|-----------|--------|\n");

    for (fr_id, desc) in frs {
        let status_and_files = if let Some(files) = traces.get(fr_id) {
            let file_links = files.iter()
                .map(|f| format!("`{}`", f.split('/').last().unwrap_or(f)))
                .collect::<Vec<_>>()
                .join(", ");
            (format!("✅ GREEN"), file_links)
        } else {
            (format!("❌ MISSING"), String::new())
        };

        output.push_str(&format!(
            "| {} | {} | {} | {} |\n",
            fr_id,
            desc.replace('|', "\\|"),
            status_and_files.1,
            status_and_files.0
        ));
    }

    // Orphans
    if !orphan_tests.is_empty() {
        output.push_str("\n## Orphan Tests\n\n");
        output.push_str("Tests that reference non-existent FRs:\n\n");
        for (file, frs_ref) in orphan_tests {
            output.push_str(&format!("- **{}**: {}\n", file, frs_ref.join(", ")));
        }
    }

    output
}
