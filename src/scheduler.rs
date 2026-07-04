use std::time::{Duration, Instant};

#[derive(Debug,Clone)]
pub struct ScheduledTask {
    pub name: String,
    pub interval: Duration,
    pub last_run: Option<Instant>,
}

impl ScheduledTask {
    pub fn new(name: impl Into<String>, interval: Duration) -> Self {
        Self { name: name.into(), interval, last_run: None }
    }
    pub fn is_due(&self) -> bool {
        match self.last_run {
            None => true,
            Some(last) => last.elapsed() >= self.interval,
        }
    }
    pub fn mark_run(&mut self) { self.last_run = Some(Instant::now()); }
}

#[derive(Default)]
pub struct Scheduler { pub tasks: Vec<ScheduledTask> }
impl Scheduler {
    pub fn new() -> Self { Self::default() }
    pub fn add(&mut self, task: ScheduledTask) { self.tasks.push(task); }
    pub fn due_tasks(&self) -> Vec<&ScheduledTask> { self.tasks.iter().filter(|t| t.is_due()).collect() }
    pub fn tick(&mut self) -> Vec<String> {
        let due: Vec<usize> = self.tasks.iter().enumerate().filter(|(_,t)| t.is_due()).map(|(i,_)| i).collect();
        let names: Vec<String> = due.iter().map(|&i| self.tasks[i].name.clone()).collect();
        for i in due { self.tasks[i].mark_run(); }
        names
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn new_task_is_due() { let t=ScheduledTask::new("t",Duration::from_secs(60)); assert!(t.is_due()); }
    #[test] fn after_run_not_due() { let mut t=ScheduledTask::new("t",Duration::from_secs(60)); t.mark_run(); assert!(!t.is_due()); }
    #[test] fn zero_interval_always_due() { let mut t=ScheduledTask::new("t",Duration::ZERO); t.mark_run(); assert!(t.is_due()); }
    #[test] fn scheduler_tick_returns_names() { let mut s=Scheduler::new(); s.add(ScheduledTask::new("job1",Duration::ZERO)); let fired=s.tick(); assert!(fired.contains(&"job1".to_string())); }
    #[test] fn scheduler_empty_tick() { let mut s=Scheduler::new(); assert!(s.tick().is_empty()); }
}
