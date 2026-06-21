// SPDX-License-Identifier: MIT OR Apache-2.0
// Rust tooling binary for checking broken links in VitePress docs.
// Reason: Rust default per Phenotype scripting hierarchy; standalone tool.

use anyhow::Result;
use pulldown_cmark::{Event, Parser};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone)]
struct LinkRef {
    path: String,
    line: usize,
}

fn main() -> Result<()> {
    let docs_root = PathBuf::from("docs-site");

    if !docs_root.exists() {
        eprintln!("Error: docs-site directory not found");
        std::process::exit(1);
    }

    let mut broken_links: HashMap<String, Vec<LinkRef>> = HashMap::new();
    let mut total_links = 0;
    let mut checked_paths = std::collections::HashSet::new();

    // Walk all markdown files (skip node_modules)
    for entry in WalkDir::new(&docs_root)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| !e.path().components().any(|c| c.as_os_str() == "node_modules"))
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("md"))
    {
        let file_path = entry.path().to_path_buf();
        let content = match std::fs::read_to_string(&file_path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Failed to read {}: {}", file_path.display(), e);
                continue;
            }
        };

        let parser = Parser::new(&content);
        let mut line_num = 1;

        for event in parser {
            // Count newlines for approximate line tracking
            if let Event::Text(text) = &event {
                line_num += text.matches('\n').count();
            }

            if let Event::Start(pulldown_cmark::Tag::Link(_, url, _)) = &event {
                let url_str = url.to_string();
                total_links += 1;

                // Skip absolute URLs and anchors
                if url_str.starts_with("http://")
                    || url_str.starts_with("https://")
                    || url_str.starts_with("#")
                {
                    continue;
                }

                // Check relative links
                let mut target_path = file_path.parent().unwrap_or_else(|| Path::new(".")).to_path_buf();
                let link_without_anchor = url_str.split('#').next().unwrap_or(&url_str);

                if !link_without_anchor.is_empty() && link_without_anchor != "/" {
                    target_path.push(link_without_anchor);

                    // Try to resolve with and without .md and index.md
                    let mut exists = false;
                    let candidates = vec![
                        target_path.clone(),
                        {
                            let mut p = target_path.clone();
                            p.set_extension("md");
                            p
                        },
                        {
                            let mut p = target_path.clone();
                            if p.is_file() {
                                p.pop();
                            }
                            p.push("index.md");
                            p
                        },
                    ];

                    for candidate in &candidates {
                        if candidate.exists() {
                            exists = true;
                            checked_paths.insert(candidate.clone());
                            break;
                        }
                    }

                    if !exists {
                        let rel_path = file_path.strip_prefix(&docs_root).unwrap_or(&file_path);
                        broken_links
                            .entry(url_str.clone())
                            .or_insert_with(Vec::new)
                            .push(LinkRef {
                                path: rel_path.display().to_string(),
                                line: line_num,
                            });
                    }
                }
            }
        }
    }

    // Report results
    println!("\n=== Doc Link Check Report ===");
    println!("Total links scanned: {}", total_links);
    println!("Paths checked: {}", checked_paths.len());
    println!("Broken links found: {}\n", broken_links.len());

    if !broken_links.is_empty() {
        for (link, refs) in broken_links.iter() {
            println!("Broken: {}", link);
            for r in refs {
                println!("  └─ {}:{}", r.path, r.line);
            }
        }
        std::process::exit(1);
    } else {
        println!("✓ All links are valid");
        std::process::exit(0);
    }
}
