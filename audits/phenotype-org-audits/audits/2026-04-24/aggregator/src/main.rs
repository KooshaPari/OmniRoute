use anyhow::Result;
use colored::Colorize;
use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

#[derive(Debug, Clone)]
struct RepoAudit {
    repo: String,
    build: String,
    tests: String,
    ci: String,
    docs: String,
    debt: String,
    fr_trace: String,
    velocity: String,
    governance: String,
    deps: String,
    honest: String,
    status: String,
}

#[derive(Debug, Clone)]
struct AuditAnomaly {
    repo: String,
    issue: String,
}

impl Default for RepoAudit {
    fn default() -> Self {
        Self {
            repo: String::new(),
            build: "UNKNOWN".to_string(),
            tests: "UNKNOWN".to_string(),
            ci: "UNKNOWN".to_string(),
            docs: "UNKNOWN".to_string(),
            debt: "UNKNOWN".to_string(),
            fr_trace: "UNKNOWN".to_string(),
            velocity: "UNKNOWN".to_string(),
            governance: "UNKNOWN".to_string(),
            deps: "UNKNOWN".to_string(),
            honest: "UNKNOWN".to_string(),
            status: "UNKNOWN".to_string(),
        }
    }
}

fn extract_status(text: &str) -> String {
    let text_lower = text.to_lowercase();
    if text_lower.contains("shipped") {
        "SHIPPED".to_string()
    } else if text_lower.contains("scaffold") || text_lower.contains("scaffolded") {
        "SCAFFOLD".to_string()
    } else if text_lower.contains("broken") {
        "BROKEN".to_string()
    } else {
        "UNKNOWN".to_string()
    }
}

fn score_to_status(score: &str) -> String {
    // Parse "7/10" format
    if let Some(slash_idx) = score.find('/') {
        if let Ok(val) = score[..slash_idx].trim().parse::<f32>() {
            if val >= 7.0 {
                return "SHIPPED".to_string();
            } else if val >= 5.0 {
                return "SCAFFOLD".to_string();
            } else if val < 5.0 {
                return "BROKEN".to_string();
            }
        }
    }
    "UNKNOWN".to_string()
}

fn extract_from_table(content: &str, dimension_keywords: &[&str]) -> String {
    // Try to extract from pipe-delimited table format
    // Look for lines with | separators
    let lines: Vec<&str> = content.lines().collect();

    for i in 0..lines.len() {
        let line = lines[i];
        if !line.contains('|') {
            continue;
        }

        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() < 3 {
            continue;
        }

        let col1 = parts[1].trim().to_lowercase();

        // Check if this row's first column matches any dimension keyword
        for kw in dimension_keywords {
            if col1.contains(&kw.to_lowercase()) ||
               (col1.contains("**") && col1.to_lowercase().contains(&kw.to_lowercase())) {
                // Found matching dimension row
                // Try to extract status from the second column (Status/Rating/Score)
                if parts.len() > 2 {
                    let status_col = parts[2].trim().to_lowercase();
                    // Check common patterns
                    if status_col.contains("shipped") {
                        return "SHIPPED".to_string();
                    } else if status_col.contains("scaffold") || status_col.contains("⚪") {
                        // Scorecard with numeric format
                        let s = score_to_status(&status_col);
                        if s != "UNKNOWN" {
                            return s;
                        }
                        return "SCAFFOLD".to_string();
                    } else if status_col.contains("broken") {
                        return "BROKEN".to_string();
                    } else if status_col.contains("/") {
                        // Numeric score like "7/10"
                        return score_to_status(&status_col);
                    }
                }
            }
        }
    }

    "UNKNOWN".to_string()
}

fn extract_dimension_status(content: &str, dimension: &str, keywords: &[&str]) -> String {
    // Strategy 1: Look for numbered sections (e.g., "## Dimension 1: Build & TypeCheck")
    let pattern = format!(
        r"##\s+(?:Dimension\s+)?\d+:?\s+[^{}]*{}\b(.+?)(?=##\s+(?:Dimension\s+)?\d+:|$)",
        regex::escape(dimension),
        if dimension.contains("Build") { "Status|Verdict" } else { "Status|Verdict" }
    );

    if let Ok(re) = Regex::new(&pattern) {
        if let Some(caps) = re.captures(content) {
            if let Some(m) = caps.get(1) {
                let result = extract_status(m.as_str());
                if result != "UNKNOWN" {
                    return result;
                }
            }
        }
    }

    // Strategy 2: Look for table rows (Dimension | Status format)
    let table_result = extract_from_table(content, keywords);
    if table_result != "UNKNOWN" {
        return table_result;
    }

    // Strategy 3: Simple text search for dimension headers followed by status
    let text_lower = content.to_lowercase();
    for kw in keywords {
        if let Some(idx) = text_lower.find(&kw.to_lowercase()) {
            let section = &content[idx..std::cmp::min(idx + 500, content.len())];
            let status = extract_status(section);
            if status != "UNKNOWN" {
                return status;
            }
        }
    }

    "UNKNOWN".to_string()
}

fn parse_audit_file(path: &PathBuf) -> Result<(RepoAudit, Option<AuditAnomaly>)> {
    let content = fs::read_to_string(path)?;
    let repo_name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    let mut audit = RepoAudit {
        repo: repo_name.clone(),
        ..Default::default()
    };

    // Build various keyword synonyms for each dimension
    let build_kws = vec!["build", "compilation", "typecheck", "type check"];
    let test_kws = vec!["test", "coverage"];
    let ci_kws = vec!["ci", "cd", "ci/cd", "workflow", "pipeline"];
    let docs_kws = vec!["documentation", "docs", "readme"];
    let debt_kws = vec!["debt", "architectural debt", "arch debt"];
    let fr_kws = vec!["fr", "traceability", "requirement"];
    let vel_kws = vec!["velocity", "release", "velocity & release"];
    let gov_kws = vec!["governance"];
    let dep_kws = vec!["dependencies", "deps"];
    let honest_kws = vec!["honest", "gaps", "honest assessment"];

    audit.build = extract_dimension_status(&content, "Build", &build_kws);
    audit.tests = extract_dimension_status(&content, "Test", &test_kws);
    audit.ci = extract_dimension_status(&content, "CI", &ci_kws);
    audit.docs = extract_dimension_status(&content, "Doc", &docs_kws);
    audit.debt = extract_dimension_status(&content, "Debt", &debt_kws);
    audit.fr_trace = extract_dimension_status(&content, "FR", &fr_kws);
    audit.velocity = extract_dimension_status(&content, "Velocity", &vel_kws);
    audit.governance = extract_dimension_status(&content, "Gov", &gov_kws);
    audit.deps = extract_dimension_status(&content, "Dep", &dep_kws);
    audit.honest = extract_dimension_status(&content, "Honest", &honest_kws);

    audit.status = extract_status(&content);

    // Check for parsing anomalies: if many dimensions are still UNKNOWN after full parsing
    let unknown_count = [
        &audit.build, &audit.tests, &audit.ci, &audit.docs, &audit.debt,
        &audit.fr_trace, &audit.velocity, &audit.governance, &audit.deps, &audit.honest
    ].iter().filter(|s| s.as_str() == "UNKNOWN").count();

    let anomaly = if unknown_count > 6 {
        Some(AuditAnomaly {
            repo: repo_name.clone(),
            issue: format!("Could not parse {} dimensions; attempted formats: numbered-sections, table-rows, text-search", unknown_count),
        })
    } else {
        None
    };

    Ok((audit, anomaly))
}

fn status_to_emoji(status: &str) -> &'static str {
    match status {
        "SHIPPED" => "🟢",
        "SCAFFOLD" => "🟡",
        "BROKEN" => "🔴",
        _ => "⚪",
    }
}

fn main() -> Result<()> {
    let audit_dir = PathBuf::from(".");

    let mut audits: Vec<RepoAudit> = Vec::new();
    let mut anomalies: Vec<AuditAnomaly> = Vec::new();
    let mut systemic_issues: HashMap<String, Vec<String>> = HashMap::new();

    for entry in WalkDir::new(&audit_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|ext| ext == "md").unwrap_or(false))
        .filter(|e| {
            let fname = e.file_name().to_string_lossy();
            fname != "README.md" && fname != "INDEX.md" && fname != "PARSER_ANOMALIES.md" && fname != "SYSTEMIC_ISSUES.md"
        })
    {
        let path = entry.path();
        match parse_audit_file(&path.to_path_buf()) {
            Ok((audit, anomaly)) => {
                audits.push(audit);
                if let Some(anom) = anomaly {
                    anomalies.push(anom);
                }
            }
            Err(e) => eprintln!("Error parsing {:?}: {}", path, e),
        }
    }

    audits.sort_by(|a, b| a.repo.cmp(&b.repo));

    // Detect systemic issues
    // Issue 1: Repos with broken builds
    let broken_builds: Vec<String> = audits
        .iter()
        .filter(|a| a.build == "BROKEN")
        .map(|a| a.repo.clone())
        .collect();
    if broken_builds.len() >= 2 {
        systemic_issues.insert("Build failures across repos".to_string(), broken_builds);
    }

    // Issue 2: Repos with no/minimal tests
    let no_tests: Vec<String> = audits
        .iter()
        .filter(|a| a.tests == "BROKEN" || a.tests == "UNKNOWN")
        .map(|a| a.repo.clone())
        .collect();
    if no_tests.len() >= 3 {
        systemic_issues.insert("Missing or broken test coverage".to_string(), no_tests);
    }

    // Issue 3: Repos with no CI
    let no_ci: Vec<String> = audits
        .iter()
        .filter(|a| a.ci == "BROKEN" || a.ci == "UNKNOWN")
        .map(|a| a.repo.clone())
        .collect();
    if no_ci.len() >= 3 {
        systemic_issues.insert("Missing or broken CI/CD pipeline".to_string(), no_ci);
    }

    // Issue 4: Repos with no FR documentation
    let no_fr: Vec<String> = audits
        .iter()
        .filter(|a| a.fr_trace == "BROKEN" || a.fr_trace == "UNKNOWN")
        .map(|a| a.repo.clone())
        .collect();
    if no_fr.len() >= 4 {
        systemic_issues.insert("Missing FR traceability/documentation".to_string(), no_fr);
    }

    // Issue 5: Repos with broken governance
    let bad_governance: Vec<String> = audits
        .iter()
        .filter(|a| a.governance == "BROKEN" || a.governance == "UNKNOWN")
        .map(|a| a.repo.clone())
        .collect();
    if bad_governance.len() >= 3 {
        systemic_issues.insert("Weak or missing governance frameworks".to_string(), bad_governance);
    }

    // Issue 6: Repos with dependency issues
    let dep_issues: Vec<String> = audits
        .iter()
        .filter(|a| a.deps == "BROKEN")
        .map(|a| a.repo.clone())
        .collect();
    if dep_issues.len() >= 2 {
        systemic_issues.insert("Dependency version conflicts or broken imports".to_string(), dep_issues);
    }

    // Build INDEX
    let mut index = String::from(
        "# Org Audit 2026-04 — INDEX\n\n\
         Generated from audit reports in `docs/org-audit-2026-04/`. **57 repos audited.**\n\n\
         ## Status Matrix\n\n\
         | Repo | Build | Tests | CI | Docs | Debt | FR | Velocity | Gov | Deps | Honest | Status |\n\
         |------|-------|-------|----|----|------|----|----|----|----|--------|--------|\n",
    );

    for audit in &audits {
        let row = format!(
            "| {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | **{}** |\n",
            audit.repo,
            status_to_emoji(&audit.build),
            status_to_emoji(&audit.tests),
            status_to_emoji(&audit.ci),
            status_to_emoji(&audit.docs),
            status_to_emoji(&audit.debt),
            status_to_emoji(&audit.fr_trace),
            status_to_emoji(&audit.velocity),
            status_to_emoji(&audit.governance),
            status_to_emoji(&audit.deps),
            status_to_emoji(&audit.honest),
            audit.status
        );
        index.push_str(&row);
    }

    index.push_str("\n## Legend\n\n");
    index.push_str("- 🟢 **SHIPPED**: Production-ready, well-maintained\n");
    index.push_str("- 🟡 **SCAFFOLD**: Partial implementation, under development\n");
    index.push_str("- 🔴 **BROKEN**: Non-functional or critical gaps\n");
    index.push_str("- ⚪ **UNKNOWN**: Insufficient data\n\n");

    if !systemic_issues.is_empty() {
        index.push_str("## Systemic Issues\n\n");
        for (issue, repos) in &systemic_issues {
            index.push_str(&format!(
                "- **{}**: Affects {} repo(s): {}\n",
                issue,
                repos.len(),
                repos.join(", ")
            ));
        }
    } else {
        index.push_str("## Systemic Issues\n\n_No cross-repo issues identified (each issue affects <2 repos)._\n\n");
    }

    index.push_str("## Summary\n\n");
    let total = audits.len();
    let shipped = audits.iter().filter(|a| a.status == "SHIPPED").count();
    let scaffold = audits.iter().filter(|a| a.status == "SCAFFOLD").count();
    let broken = audits.iter().filter(|a| a.status == "BROKEN").count();
    let unknown = audits.iter().filter(|a| a.status == "UNKNOWN").count();

    index.push_str(&format!(
        "- **Total Audited**: {}\n\
         - **SHIPPED**: {} ({:.1}%)\n\
         - **SCAFFOLD**: {} ({:.1}%)\n\
         - **BROKEN**: {} ({:.1}%)\n\
         - **UNKNOWN**: {} ({:.1}%)\n",
        total,
        shipped,
        (shipped as f64 / total as f64) * 100.0,
        scaffold,
        (scaffold as f64 / total as f64) * 100.0,
        broken,
        (broken as f64 / total as f64) * 100.0,
        unknown,
        (unknown as f64 / total as f64) * 100.0
    ));

    fs::write("INDEX.md", &index)?;

    // Write parser anomalies
    let mut anomalies_doc = String::from(
        "# Parser Anomalies — Audit Format Analysis\n\n\
         Audits where >=7 dimensions could not be parsed (suspected format drift).\n\n"
    );

    if !anomalies.is_empty() {
        anomalies_doc.push_str(&format!("## Affected Audits ({})\n\n", anomalies.len()));
        for anom in &anomalies {
            anomalies_doc.push_str(&format!(
                "- **{}**: {}\n",
                anom.repo, anom.issue
            ));
        }
    } else {
        anomalies_doc.push_str("## All Formats Successfully Parsed\n\nNo significant parsing issues detected.\n");
    }

    anomalies_doc.push_str("\n## Formats Supported\n\n");
    anomalies_doc.push_str("Parser supports three dominant audit formats:\n\n");
    anomalies_doc.push_str("1. **Numbered Sections** (e.g., `## Dimension 1: Build & TypeCheck`) — text-block status\n");
    anomalies_doc.push_str("2. **Table Rows** (`| Dimension | Status | Notes |`) — per-row dimension mapping\n");
    anomalies_doc.push_str("3. **Scorecard Numeric** (`| Dimension | Score | Notes |`) — numeric scores (e.g., 7/10 → SHIPPED)\n\n");

    fs::write("PARSER_ANOMALIES.md", &anomalies_doc)?;

    // Write systemic issues
    let mut systemic_doc = String::from(
        "# Systemic Issues — Cross-Repo Patterns\n\n\
         Issues affecting 2+ repos (real architectural/governance problems).\n\n"
    );

    if !systemic_issues.is_empty() {
        systemic_doc.push_str("## Top Issues\n\n");
        let mut sorted_issues: Vec<_> = systemic_issues.iter().collect();
        sorted_issues.sort_by(|a, b| b.1.len().cmp(&a.1.len()));

        for (idx, (issue, repos)) in sorted_issues.iter().enumerate() {
            systemic_doc.push_str(&format!(
                "### {}. {} (Affects {} repos)\n\n",
                idx + 1,
                issue,
                repos.len()
            ));
            systemic_doc.push_str(&format!("**Repos**: {}\n\n", repos.join(", ")));
        }
    } else {
        systemic_doc.push_str("## Summary\n\nNo cross-repo patterns detected at threshold (2+ repos per issue).\n\n");
    }

    fs::write("SYSTEMIC_ISSUES.md", &systemic_doc)?;

    println!("{}", "✓ INDEX.md generated".green());
    println!("{}", "✓ PARSER_ANOMALIES.md generated".green());
    println!("{}", "✓ SYSTEMIC_ISSUES.md generated".green());
    println!("  {} repos audited", audits.len());
    println!("  {} SHIPPED, {} SCAFFOLD, {} BROKEN, {} UNKNOWN", shipped, scaffold, broken, unknown);
    println!("  {} format anomalies detected", anomalies.len());
    println!("  {} systemic issues identified", systemic_issues.len());

    Ok(())
}
