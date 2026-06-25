//! Topological sort algorithms for the DAG.
//!
//! Provides Kahn's algorithm (iterative, queue-based) and a DFS-based
//! variant, both producing a linear ordering.

use std::collections::{HashMap, VecDeque};
use std::hash::Hash;

use crate::dag::{Dag, DagError};

// ---------------------------------------------------------------------------
// Kahn's algorithm (BFS-based topological sort)
// ---------------------------------------------------------------------------

/// Compute a topological ordering of `dag` using Kahn's algorithm.
///
/// Returns `Ok(Vec)` where the nodes appear in topologically-sorted order
/// (parents before children). Returns `Err` if the graph contains a cycle.
pub fn kahn_sort<K>(dag: &Dag<K>) -> Result<Vec<&K>, DagError>
where
    K: Eq + Hash + Clone + std::fmt::Debug,
{
    // in-degree for every node
    let mut in_degree: HashMap<&K, usize> = dag.iter_nodes().map(|n| (n, 0)).collect();

    for node in dag.iter_nodes() {
        if let Some(children) = dag.children_of(node) {
            for child in children {
                *in_degree.entry(child).or_insert(0) += 1;
            }
        }
    }

    // seed queue with zero-in-degree nodes
    let mut queue: VecDeque<&K> = in_degree
        .iter()
        .filter(|(_, deg)| **deg == 0)
        .map(|(n, _)| *n)
        .collect();

    let mut order = Vec::with_capacity(dag.node_count());

    while let Some(node) = queue.pop_front() {
        order.push(node);

        if let Some(children) = dag.children_of(node) {
            for child in children {
                let deg = in_degree.get_mut(child).expect("child must be in map");
                *deg -= 1;
                if *deg == 0 {
                    queue.push_back(child);
                }
            }
        }
    }

    if order.len() != dag.node_count() {
        return Err(DagError::CycleDetected(
            "graph".into(),
            "contains a cycle".into(),
        ));
    }

    Ok(order)
}

// ---------------------------------------------------------------------------
// DFS-based topological sort
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DfsColor {
    White, // unvisited
    Gray,  // in the current DFS path (cycle detection)
    Black, // fully processed
}

/// Compute a topological ordering using DFS with cycle detection.
///
/// Returns `Ok(Vec)` on success, `Err` if a cycle is detected.
pub fn dfs_sort<K>(dag: &Dag<K>) -> Result<Vec<&K>, DagError>
where
    K: Eq + Hash + Clone + std::fmt::Debug,
{
    let mut color: HashMap<&K, DfsColor> = dag.iter_nodes().map(|n| (n, DfsColor::White)).collect();
    let mut order = Vec::with_capacity(dag.node_count());

    for start in dag.iter_nodes() {
        if color[start] == DfsColor::White {
            visit(dag, start, &mut color, &mut order)?;
        }
    }

    // DFS pushes at the end; reverse to get parent-before-child ordering.
    order.reverse();
    Ok(order)
}

fn visit<'a, K>(
    dag: &'a Dag<K>,
    node: &'a K,
    color: &mut HashMap<&'a K, DfsColor>,
    order: &mut Vec<&'a K>,
) -> Result<(), DagError>
where
    K: Eq + Hash + Clone + std::fmt::Debug,
{
    color.insert(node, DfsColor::Gray);

    if let Some(children) = dag.children_of(node) {
        for child in children {
            match color.get(child).copied().unwrap_or(DfsColor::White) {
                DfsColor::Gray => {
                    return Err(DagError::CycleDetected(
                        format!("{:?}", node),
                        format!("{:?}", child),
                    ));
                }
                DfsColor::White => visit(dag, child, color, order)?,
                DfsColor::Black => continue,
            }
        }
    }

    color.insert(node, DfsColor::Black);
    order.push(node);
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kahn_linear_chain() {
        let mut dag = Dag::new();
        for n in &["a", "b", "c", "d"] {
            dag.add_node(*n).unwrap();
        }
        dag.add_edge("a", "b").unwrap();
        dag.add_edge("b", "c").unwrap();
        dag.add_edge("c", "d").unwrap();

        let order = kahn_sort(&dag).unwrap();
        let ids: Vec<&str> = order.into_iter().copied().collect();
        // a must be before b before c before d
        let pos = |name: &str| ids.iter().position(|x| *x == name).unwrap();
        assert!(pos("a") < pos("b"));
        assert!(pos("b") < pos("c"));
        assert!(pos("c") < pos("d"));
    }

    #[test]
    fn kahn_diamond() {
        let mut dag = Dag::new();
        for n in &["a", "b", "c", "d"] {
            dag.add_node(*n).unwrap();
        }
        dag.add_edge("a", "b").unwrap();
        dag.add_edge("a", "c").unwrap();
        dag.add_edge("b", "d").unwrap();
        dag.add_edge("c", "d").unwrap();

        let order = kahn_sort(&dag).unwrap();
        let ids: Vec<&str> = order.into_iter().copied().collect();
        let pos = |name: &str| ids.iter().position(|x| *x == name).unwrap();
        assert!(pos("a") < pos("b"));
        assert!(pos("a") < pos("c"));
        assert!(pos("b") < pos("d"));
        assert!(pos("c") < pos("d"));
    }

    #[test]
    fn kahn_cycle_detection() {
        let mut dag = Dag::new();
        for n in &["a", "b", "c"] {
            dag.add_node(*n).unwrap();
        }
        dag.add_edge("a", "b").unwrap();
        dag.add_edge("b", "c").unwrap();
        dag.add_edge("c", "a").unwrap(); // cycle

        assert!(kahn_sort(&dag).is_err());
    }

    #[test]
    fn dfs_sort_matches_kahn() {
        let mut dag = Dag::new();
        for n in &["a", "b", "c", "d", "e", "f"] {
            dag.add_node(*n).unwrap();
        }
        dag.add_edge("a", "b").unwrap();
        dag.add_edge("a", "c").unwrap();
        dag.add_edge("b", "d").unwrap();
        dag.add_edge("c", "d").unwrap();
        dag.add_edge("d", "e").unwrap();
        dag.add_edge("c", "f").unwrap();

        let kahn_order = kahn_sort(&dag).unwrap();
        let dfs_order = dfs_sort(&dag).unwrap();

        // Both should produce valid topological orders of the same length.
        assert_eq!(kahn_order.len(), dfs_order.len());

        // Verify DFS order respects all edges.
        for node in dag.iter_nodes() {
            if let Some(children) = dag.children_of(node) {
                let n_pos = dfs_order.iter().position(|x| *x == node).unwrap();
                for child in children {
                    let c_pos = dfs_order.iter().position(|x| *x == child).unwrap();
                    assert!(n_pos < c_pos, "DFS: {} should come before {}", node, child);
                }
            }
        }
    }

    #[test]
    fn dfs_cycle_detection() {
        let mut dag = Dag::new();
        for n in &["a", "b", "c"] {
            dag.add_node(*n).unwrap();
        }
        dag.add_edge("a", "b").unwrap();
        dag.add_edge("b", "c").unwrap();
        dag.add_edge("c", "a").unwrap();
        assert!(dfs_sort(&dag).is_err());
    }

    #[test]
    fn kahn_empty_dag() {
        let dag: Dag<u32> = Dag::new();
        let order = kahn_sort(&dag).unwrap();
        assert!(order.is_empty());
    }

    #[test]
    fn dfs_empty_dag() {
        let dag: Dag<u32> = Dag::new();
        let order = dfs_sort(&dag).unwrap();
        assert!(order.is_empty());
    }
}
