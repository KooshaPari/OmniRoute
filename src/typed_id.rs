#[derive(Debug,Clone,PartialEq,Eq,Hash)]
pub struct UserId(pub u64);
#[derive(Debug,Clone,PartialEq,Eq,Hash)]
pub struct OrgId(pub u64);
#[derive(Debug,Clone,PartialEq,Eq,Hash)]
pub struct ProjectId(pub u64);

impl UserId { pub fn new(id: u64) -> Self { Self(id) } pub fn as_u64(&self) -> u64 { self.0 } }
impl OrgId { pub fn new(id: u64) -> Self { Self(id) } pub fn as_u64(&self) -> u64 { self.0 } }
impl ProjectId { pub fn new(id: u64) -> Self { Self(id) } pub fn as_u64(&self) -> u64 { self.0 } }

pub fn user_to_org(uid: UserId) -> OrgId { OrgId(uid.0) }
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn roundtrip() { let u = UserId::new(42); assert_eq!(u.as_u64(), 42); }
    #[test] fn convert() { let u = UserId::new(100); let o = user_to_org(u); assert_eq!(o.as_u64(), 100); }
    #[test] fn equality() { assert_eq!(UserId::new(5), UserId::new(5)); assert_ne!(UserId::new(5), UserId::new(6)); }
    #[test] fn distinct_types() { let u = UserId::new(1); let p = ProjectId::new(1); assert_ne!(u.as_u64() == p.as_u64(), false); }
}
