pub struct RadixTrie {
    root: Node,
}
struct Node {
    children: Vec<(String, Box<Node>)>,
    is_word: bool,
}
impl Node {
    fn new() -> Self { Self { children: Vec::new(), is_word: false } }
}
impl RadixTrie {
    pub fn new() -> Self { Self { root: Node::new() } }
    pub fn insert(&mut self, word: &str) {
        let mut cur = &mut self.root;
        let mut rest = word.to_string();
        loop {
            let mut found = None;
            for (i, (k, _)) in cur.children.iter().enumerate() {
                let common: usize = k.chars().zip(rest.chars()).take_while(|(a, b)| a == b).count();
                if common > 0 {
                    found = Some((i, common));
                    break;
                }
            }
            match found {
                None => {
                    cur.children.push((rest.clone(), Box::new(Node { children: Vec::new(), is_word: true })));
                    return;
                }
                Some((i, common)) => {
                    let k = cur.children[i].0.clone();
                    let child = &mut cur.children[i];
                    if common == k.chars().count() && common == rest.chars().count() {
                        child.1.is_word = true;
                        return;
                    }
                    if common == k.chars().count() {
                        rest = rest[common..].to_string();
                        cur = &mut cur.children[i].1;
                        continue;
                    }
                    // split edge: common < klen and common < rest.len. New edge label = k[..common].
                    // split_node holds the original word status of the prefix; old children become split_node's child via k_tail.
                    let k_tail = k[common..].to_string();
                    let r_tail = rest[common..].to_string();
                    let old_children = std::mem::take(&mut cur.children[i].1.children);
                    let old_is_word = cur.children[i].1.is_word;
                    let mut split_node = Node::new();
                    // split_node represents the common prefix; it IS a word if the original was a complete word.
                    // The original edge k represented the old word exactly (so old_is_word reflected the full old word).
                    // After shortening the label to k[..common], that prefix may or may not be a word.
                    // Specifically: old_is_word means k[..klen] (the OLD key) was a word. After shortening to k[..common], the prefix is a word iff old_is_word AND common == klen. But we only enter split when common < klen, so the prefix is NOT a word.
                    split_node.is_word = false;
                    if !k_tail.is_empty() {
                        split_node.children.push((k_tail, Box::new(Node { children: old_children, is_word: old_is_word })));
                    }
                    if !r_tail.is_empty() {
                        split_node.children.push((r_tail, Box::new(Node::new())));
                        split_node.children.last_mut().unwrap().1.is_word = true;
                    } else {
                        split_node.is_word = true;
                    }
                    // Re-label edge to common prefix only.
                    let prefix: String = k.chars().take(common).collect();
                    cur.children[i].0 = prefix;
                    cur.children[i].1 = Box::new(split_node);
                    return;
                }
            }
        }
    }
    pub fn contains(&self, word: &str) -> bool {
        Self::contains_node(&self.root, word)
    }
    fn contains_node(node: &Node, word: &str) -> bool {
        if word.is_empty() { return node.is_word; }
        for (k, child) in &node.children {
            let common: usize = k.chars().zip(word.chars()).take_while(|(a, b)| a == b).count();
            if common == 0 { continue; }
            let klen = k.chars().count();
            let wlen = word.chars().count();
            if common < klen {
                // split-edge: this key diverges mid-way from word. Only an exact word matches if common == wlen.
                if common == wlen { return node.is_word; }
                continue;
            }
            // common == klen (whole key matched). Descend with rest of word.
            if common == wlen { return Self::contains_node(child.as_ref(), ""); }
            return Self::contains_node(child.as_ref(), &word[common..]);
        }
        false
    }
    pub fn len(&self) -> usize { self.count_node(&self.root) }
    fn count_node(&self, n: &Node) -> usize {
        let mut c = if n.is_word { 1 } else { 0 };
        for (_, ch) in &n.children { c += self.count_node(ch); }
        c
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn insert_contains() {
        let mut t = RadixTrie::new();
        t.insert("hello");
        t.insert("help");
        t.insert("world");
        assert!(t.contains("hello"));
        assert!(t.contains("help"));
        assert!(t.contains("world"));
        assert!(!t.contains("hell"));
        assert!(!t.contains("hellos"));
    }
    #[test] fn shared_prefix() {
        let mut t = RadixTrie::new();
        t.insert("test");
        t.insert("team");
        t.insert("tea");
        assert!(t.contains("test"));
        assert!(t.contains("team"));
        assert!(t.contains("tea"));
        assert!(!t.contains("te"));
    }
    #[test] fn empty_trie() {
        let t = RadixTrie::new();
        assert_eq!(t.len(), 0);
        assert!(!t.contains("anything"));
    }
    #[test] fn count() {
        let mut t = RadixTrie::new();
        t.insert("a");
        t.insert("ab");
        t.insert("abc");
        assert_eq!(t.len(), 3);
    }
}
