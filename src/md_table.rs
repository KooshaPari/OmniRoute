pub fn render(headers: &[&str], rows: &[Vec<&str>]) -> String {
    if headers.is_empty() { return String::new(); }
    let col_count = headers.len();
    let mut widths = vec![0usize; col_count];
    for (i, h) in headers.iter().enumerate() {
        widths[i] = h.chars().count();
    }
    for row in rows {
        for (i, cell) in row.iter().enumerate() {
            if i >= col_count { break; }
            widths[i] = widths[i].max(cell.chars().count());
        }
    }
    let mut out = String::new();
    let head: Vec<String> = headers.iter().enumerate()
        .map(|(i, h)| format!("{:<w$}", h, w = widths[i])).collect();
    out.push_str(&head.join(" | "));
    out.push('\n');
    let sep: Vec<String> = widths.iter().map(|w| "-".repeat(*w)).collect();
    out.push_str(&sep.join(" | "));
    out.push('\n');
    for row in rows {
        let cells: Vec<String> = (0..col_count).map(|i| {
            let cell = row.get(i).copied().unwrap_or("");
            format!("{:<w$}", cell, w = widths[i])
        }).collect();
        out.push_str(&cells.join(" | "));
        out.push('\n');
    }
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn basic() {
        let t = render(&["name", "age"], &[vec!["alice", "30"], vec!["bob", "7"]]);
        assert!(t.contains("alice"));
        assert!(t.contains(" | "));
        let lines: Vec<&str> = t.lines().collect();
        assert!(lines[0].contains("name"));
        assert!(lines[1].starts_with("---"));
    }
    #[test] fn pad_unequal() {
        let t = render(&["name", "age"], &[vec!["alice", "30"], vec!["bob", "7"]]);
        assert!(t.contains("alice"));
        let lines: Vec<&str> = t.lines().collect();
        assert!(lines[0].chars().count() == lines[1].chars().count());
    }
    #[test] fn empty_headers() {
        assert_eq!(render(&[], &[vec!["a"]]), "");
    }
    #[test] fn extra_cells_ignored() {
        let t = render(&["x"], &[vec!["a", "b", "c"]]);
        assert!(t.contains("a"));
        let lines: Vec<&str> = t.lines().collect();
        assert!(!lines[0].contains('b'));
    }
}
