//! Parallel-bucket scheduler for DAG execution.
//!
//! Given a DAG, the scheduler groups nodes into "buckets" such that all
//! nodes within a bucket can execute in parallel, and buckets are ordered
//! so that bucket *i* must complete before bucket *i+1* begins.
//!
//! # Algorithm
//!
//! 1. Compute a topological order via Kahn's algorithm.
//! 2. Assign each node a **rank** = max(parent ranks) + 1 (source nodes get
//!    rank 0).
//! 3. Group nodes by rank → each rank is a parallel bucket.
//! 4. Return the list of buckets.

use std::collections::HashMap;
use std::hash::Hash;

use crate::dag::{Dag, DagError};
use crate::topo;

/// A wall of parallel-execution buckets produced by the scheduler.
///
/// Buckets are ordered: bucket[0] must finish before bucket[1] starts, etc.
/// Within a bucket all nodes are independent and can be scheduled in parallel.
pub struct Schedule<K> {
    /// Ordered list of buckets. Each bucket is a set of node references.
    pub buckets: Vec<Vec<K>>,
    /// Maximum concurrency (size of the largest bucket).
    pub max_concurrency: usize,
}

/// Compute a parallel-bucket schedule from the given DAG.
///
/// Returns an error if the DAG contains a cycle.
pub fn schedule<K>(dag: &Dag<K>) -> Result<Schedule<K>, DagError>
where
    K: Eq + Hash + Clone + std::fmt::Debug,
{
    // 1. Topological order (validates acyclicity).
    let topo_order = topo::kahn_sort(dag)?;

    // 2. Assign ranks.
    let mut rank: HashMap<&K, usize> = HashMap::with_capacity(dag.node_count());

    for node in &topo_order {
        let parent_rank = dag
            .parents_of(node)
            .unwrap_or(&[])
            .iter()
            .filter_map(|p| rank.get(p))
            .max()
            .copied()
            .unwrap_or(0);

        rank.insert(node, parent_rank + 1);
    }

    // 3. Group by rank into buckets.
    let max_rank = rank.values().copied().max().unwrap_or(0);
    let mut buckets: Vec<Vec<K>> = vec![Vec::new(); max_rank];

    for (node, r) in &rank {
        // r is 1-based; bucket index = r - 1
        buckets[*r - 1].push((*node).clone());
    }

    let max_concurrency = buckets.iter().map(|b| b.len()).max().unwrap_or(0);

    Ok(Schedule {
        buckets,
        max_concurrency,
    })
}

/// Print a human-readable schedule summary.
///
/// Only available when `std`/default formatting is sufficient.
pub fn format_schedule<K>(schedule: &Schedule<K>) -> String
where
    K: std::fmt::Debug,
{
    let mut out = String::new();
    out.push_str(&format!(
        "Schedule ({} buckets, max concurrency = {})\n",
        schedule.buckets.len(),
        schedule.max_concurrency
    ));
    for (i, bucket) in schedule.buckets.iter().enumerate() {
        out.push_str(&format!("  Bucket {}: {:?}\n", i, bucket));
    }
    out
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn build_linear_dag() -> Dag<&'static str> {
        let mut dag = Dag::new();
        for n in &["a", "b", "c"] {
            dag.add_node(*n).unwrap();
        }
        dag.add_edge("a", "b").unwrap();
        dag.add_edge("b", "c").unwrap();
        dag
    }

    #[test]
    fn linear_schedule() {
        let dag = build_linear_dag();
        let sched = schedule(&dag).unwrap();
        // 3 nodes, no parallelism → one bucket per node
        assert_eq!(sched.buckets.len(), 3);
        assert_eq!(sched.max_concurrency, 1);
        assert_eq!(sched.buckets[0], vec!["a"]);
        assert_eq!(sched.buckets[1], vec!["b"]);
        assert_eq!(sched.buckets[2], vec!["c"]);
    }

    #[test]
    fn diamond_parallelism() {
        let mut dag = Dag::new();
        for n in &["a", "b", "c", "d"] {
            dag.add_node(*n).unwrap();
        }
        dag.add_edge("a", "b").unwrap();
        dag.add_edge("a", "c").unwrap();
        dag.add_edge("b", "d").unwrap();
        dag.add_edge("c", "d").unwrap();

        let sched = schedule(&dag).unwrap();
        // Buckets: [a], [b, c], [d]
        assert_eq!(sched.buckets.len(), 3);
        assert_eq!(sched.max_concurrency, 2);

        let b0: std::collections::BTreeSet<_> = sched.buckets[0].iter().collect();
        let b1: std::collections::BTreeSet<_> = sched.buckets[1].iter().collect();
        let b2: std::collections::BTreeSet<_> = sched.buckets[2].iter().collect();

        assert_eq!(b0, std::collections::BTreeSet::from([&"a"]));
        assert_eq!(b1, std::collections::BTreeSet::from([&"b", &"c"]));
        assert_eq!(b2, std::collections::BTreeSet::from([&"d"]));
    }

    #[test]
    fn fan_out_fan_in() {
        let mut dag = Dag::new();
        for n in &["root", "a1", "a2", "a3", "leaf"] {
            dag.add_node(*n).unwrap();
        }
        dag.add_edge("root", "a1").unwrap();
        dag.add_edge("root", "a2").unwrap();
        dag.add_edge("root", "a3").unwrap();
        dag.add_edge("a1", "leaf").unwrap();
        dag.add_edge("a2", "leaf").unwrap();
        dag.add_edge("a3", "leaf").unwrap();

        let sched = schedule(&dag).unwrap();
        assert_eq!(sched.buckets.len(), 3);
        assert_eq!(sched.max_concurrency, 3); // a1, a2, a3 in parallel

        let b1: std::collections::BTreeSet<_> = sched.buckets[1].iter().collect();
        assert_eq!(
            b1,
            std::collections::BTreeSet::from([&"a1", &"a2", &"a3"])
        );
    }

    #[test]
    fn empty_schedule() {
        let dag: Dag<u32> = Dag::new();
        let sched = schedule(&dag).unwrap();
        assert!(sched.buckets.is_empty());
        assert_eq!(sched.max_concurrency, 0);
    }

    #[test]
    fn single_node() {
        let mut dag = Dag::new();
        dag.add_node("only").unwrap();
        let sched = schedule(&dag).unwrap();
        assert_eq!(sched.buckets.len(), 1);
        assert_eq!(sched.buckets[0], vec!["only"]);
        assert_eq!(sched.max_concurrency, 1);
    }

    #[test]
    fn cycle_returns_error() {
        let mut dag = Dag::new();
        for n in &["x", "y", "z"] {
            dag.add_node(*n).unwrap();
        }
        dag.add_edge("x", "y").unwrap();
        dag.add_edge("y", "z").unwrap();
        dag.add_edge("z", "x").unwrap();
        assert!(schedule(&dag).is_err());
    }

    #[test]
    fn multi_source_dag() {
        let mut dag = Dag::new();
        for n in &["s1", "s2", "mid", "t"] {
            dag.add_node(*n).unwrap();
        }
        dag.add_edge("s1", "mid").unwrap();
        dag.add_edge("s2", "mid").unwrap();
        dag.add_edge("mid", "t").unwrap();

        let sched = schedule(&dag).unwrap();
        assert_eq!(sched.buckets.len(), 3);
        // Bucket 0: all sources
        let b0: std::collections::BTreeSet<_> = sched.buckets[0].iter().collect();
        assert_eq!(b0, std::collections::BTreeSet::from([&"s1", &"s2"]));
        assert_eq!(sched.max_concurrency, 2);
    }

    #[test]
    fn format_output() {
        let mut dag = Dag::new();
        for n in &["a", "b", "c"] {
            dag.add_node(*n).unwrap();
        }
        dag.add_edge("a", "b").unwrap();
        dag.add_edge("a", "c").unwrap();
        let sched = schedule(&dag).unwrap();
        let formatted = format_schedule(&sched);
        assert!(formatted.contains("2 buckets"));
        assert!(formatted.contains("max concurrency = 2"));
    }
}
