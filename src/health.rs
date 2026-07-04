#[derive(Debug,Clone,PartialEq)]
pub enum HealthStatus { Healthy, Degraded, Unhealthy }

#[derive(Debug,Clone)]
pub struct HealthCheck { pub name: String, pub status: HealthStatus, pub message: Option<String> }

#[derive(Debug,Default)]
pub struct HealthReport { pub checks: Vec<HealthCheck> }

impl HealthReport {
    pub fn new() -> Self { Self::default() }
    pub fn add(&mut self, c: HealthCheck) { self.checks.push(c); }
    pub fn overall(&self) -> HealthStatus {
        if self.checks.iter().any(|c| c.status == HealthStatus::Unhealthy) { HealthStatus::Unhealthy }
        else if self.checks.iter().any(|c| c.status == HealthStatus::Degraded) { HealthStatus::Degraded }
        else { HealthStatus::Healthy }
    }
    pub fn healthy_count(&self) -> usize { self.checks.iter().filter(|c| c.status == HealthStatus::Healthy).count() }
    pub fn total(&self) -> usize { self.checks.len() }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn all_healthy() { let mut r=HealthReport::new(); r.add(HealthCheck{name:"a".into(),status:HealthStatus::Healthy,message:None}); assert_eq!(r.overall(),HealthStatus::Healthy); }
    #[test] fn degraded() { let mut r=HealthReport::new(); r.add(HealthCheck{name:"a".into(),status:HealthStatus::Degraded,message:None}); assert_eq!(r.overall(),HealthStatus::Degraded); }
    #[test] fn unhealthy_wins() { let mut r=HealthReport::new(); r.add(HealthCheck{name:"a".into(),status:HealthStatus::Degraded,message:None}); r.add(HealthCheck{name:"b".into(),status:HealthStatus::Unhealthy,message:None}); assert_eq!(r.overall(),HealthStatus::Unhealthy); }
    #[test] fn empty_healthy() { assert_eq!(HealthReport::new().overall(),HealthStatus::Healthy); }
    #[test] fn counts() { let mut r=HealthReport::new(); r.add(HealthCheck{name:"a".into(),status:HealthStatus::Healthy,message:None}); r.add(HealthCheck{name:"b".into(),status:HealthStatus::Degraded,message:None}); assert_eq!(r.healthy_count(),1); assert_eq!(r.total(),2); }
}
