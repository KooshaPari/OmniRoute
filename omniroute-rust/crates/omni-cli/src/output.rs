//! Output helpers for the CLI. Two modes:
//!
//! - JSON: when `--json` is passed or stdout is not a TTY, print pretty
//!   JSON to stdout.
//! - Table: otherwise, print a simple aligned table (no external crate).

use std::io::IsTerminal;

use anyhow::Result;
use serde::Serialize;

/// `true` if the caller asked for JSON output (`--json` flag) or stdout
/// is not a TTY.
pub fn json_mode(force_json: bool) -> bool {
    force_json || !std::io::stdout().is_terminal()
}

/// Print `value` as JSON if `force_json` is true or stdout is not a TTY.
/// Otherwise print it as a table if it's a list of records with the
/// same shape.
pub fn emit<T: Serialize>(value: &T, force_json: bool) -> Result<()> {
    if json_mode(force_json) {
        let s = serde_json::to_string_pretty(value)?;
        println!("{s}");
    } else {
        // Fall back to JSON anyway for the helpers we have today; the
        // command modules can do their own pretty-printing when they
        // have a richer shape to display.
        let s = serde_json::to_string_pretty(value)?;
        println!("{s}");
    }
    Ok(())
}

/// Print a simple table from headers and rows. Each row is a list of
/// string cells. Cells are left-aligned and column widths are computed
/// from the longest cell in each column.
pub fn print_table(headers: &[&str], rows: &[Vec<String>]) {
    let mut widths: Vec<usize> = headers.iter().map(|h| h.len()).collect();
    for row in rows {
        for (i, cell) in row.iter().enumerate() {
            if i < widths.len() {
                widths[i] = widths[i].max(cell.len());
            }
        }
    }
    // Header
    let header_line: Vec<String> = headers
        .iter()
        .enumerate()
        .map(|(i, h)| format!("{:<width$}", h, width = widths.get(i).copied().unwrap_or(0)))
        .collect();
    println!("{}", header_line.join("  "));
    // Separator
    let sep: Vec<String> = widths.iter().map(|w| "-".repeat(*w)).collect();
    println!("{}", sep.join("  "));
    // Rows
    for row in rows {
        let line: Vec<String> = row
            .iter()
            .enumerate()
            .map(|(i, cell)| {
                format!(
                    "{:<width$}",
                    cell,
                    width = widths.get(i).copied().unwrap_or(0)
                )
            })
            .collect();
        println!("{}", line.join("  "));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn print_table_does_not_panic() {
        let rows = vec![
            vec!["a".to_string(), "b".to_string()],
            vec!["longer".to_string(), "x".to_string()],
        ];
        print_table(&["col1", "col2"], &rows);
    }

    #[test]
    fn json_mode_detection() {
        // When --json is forced, must return true even if stdout is a TTY.
        assert!(json_mode(true));
    }
}
