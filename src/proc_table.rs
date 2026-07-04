#[derive(Debug,Clone,PartialEq)]
pub enum ProcStatus { Running, Stopped, Failed }
impl ProcStatus {
    pub fn as_str(&self) -> &str { match self { Self::Running=>"running", Self::Stopped=>"stopped", Self::Failed=>"failed" } }
}

#[derive(Debug,Clone)]
pub struct ProcRow { pub pid: u32, pub name: String, pub status: ProcStatus, pub cpu_pct: f32, pub mem_mb: u64 }

#[derive(Debug,Default)]
pub struct ProcTable { pub rows: Vec<ProcRow> }
impl ProcTable {
    pub fn new() -> Self { Self::default() }
    pub fn add(&mut self, r: ProcRow) { self.rows.push(r); }
    pub fn running_count(&self) -> usize { self.rows.iter().filter(|r| r.status==ProcStatus::Running).count() }
    pub fn find_by_pid(&self, pid: u32) -> Option<&ProcRow> { self.rows.iter().find(|r| r.pid==pid) }
    pub fn sort_by_cpu(&mut self) { self.rows.sort_by(|a,b| b.cpu_pct.partial_cmp(&a.cpu_pct).unwrap_or(std::cmp::Ordering::Equal)); }
    pub fn total_mem_mb(&self) -> u64 { self.rows.iter().map(|r| r.mem_mb).sum() }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn add_and_count() { let mut t=ProcTable::new(); t.add(ProcRow{pid:1,name:"a".into(),status:ProcStatus::Running,cpu_pct:10.0,mem_mb:50}); assert_eq!(t.running_count(),1); }
    #[test] fn find_pid() { let mut t=ProcTable::new(); t.add(ProcRow{pid:42,name:"b".into(),status:ProcStatus::Running,cpu_pct:0.0,mem_mb:0}); assert!(t.find_by_pid(42).is_some()); assert!(t.find_by_pid(99).is_none()); }
    #[test] fn sort_cpu() { let mut t=ProcTable::new(); t.add(ProcRow{pid:1,name:"".into(),status:ProcStatus::Running,cpu_pct:5.0,mem_mb:0}); t.add(ProcRow{pid:2,name:"".into(),status:ProcStatus::Running,cpu_pct:80.0,mem_mb:0}); t.sort_by_cpu(); assert_eq!(t.rows[0].pid,2); }
    #[test] fn total_mem() { let mut t=ProcTable::new(); t.add(ProcRow{pid:1,name:"".into(),status:ProcStatus::Running,cpu_pct:0.0,mem_mb:100}); t.add(ProcRow{pid:2,name:"".into(),status:ProcStatus::Stopped,cpu_pct:0.0,mem_mb:200}); assert_eq!(t.total_mem_mb(),300); }
    #[test] fn status_str() { assert_eq!(ProcStatus::Running.as_str(),"running"); assert_eq!(ProcStatus::Failed.as_str(),"failed"); }
}
