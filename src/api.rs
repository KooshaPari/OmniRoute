use std::collections::HashMap;

#[derive(Debug,Clone,PartialEq)]
pub enum RouteMethod { Get, Post, Put, Delete }

impl RouteMethod {
    pub fn as_str(&self) -> &str {
        match self { Self::Get=>"GET", Self::Post=>"POST", Self::Put=>"PUT", Self::Delete=>"DELETE" }
    }
}

#[derive(Debug,Clone)]
pub struct Route {
    pub method: RouteMethod,
    pub path: String,
    pub handler: String,
}

#[derive(Default)]
pub struct ApiRegistry { pub routes: Vec<Route> }

impl ApiRegistry {
    pub fn new() -> Self { Self::default() }
    pub fn add(&mut self, r: Route) { self.routes.push(r); }
    pub fn find(&self, method: &RouteMethod, path: &str) -> Option<&Route> {
        self.routes.iter().find(|r| &r.method == method && r.path == path)
    }
    pub fn routes_by_method(&self, m: &RouteMethod) -> Vec<&Route> {
        self.routes.iter().filter(|r| &r.method == m).collect()
    }
    pub fn count(&self) -> usize { self.routes.len() }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn add_and_find() {
        let mut r = ApiRegistry::new();
        r.add(Route { method: RouteMethod::Get, path: "/health".into(), handler: "health_check".into() });
        assert!(r.find(&RouteMethod::Get, "/health").is_some());
        assert!(r.find(&RouteMethod::Get, "/missing").is_none());
    }
    #[test] fn method_filter() {
        let mut r = ApiRegistry::new();
        r.add(Route { method: RouteMethod::Get, path: "/a".into(), handler: "".into() });
        r.add(Route { method: RouteMethod::Post, path: "/b".into(), handler: "".into() });
        assert_eq!(r.routes_by_method(&RouteMethod::Get).len(), 1);
        assert_eq!(r.routes_by_method(&RouteMethod::Post).len(), 1);
    }
    #[test] fn count() { let mut r = ApiRegistry::new(); r.add(Route{method:RouteMethod::Get,path:"/".into(),handler:"".into()}); assert_eq!(r.count(), 1); }
    #[test] fn method_str() { assert_eq!(RouteMethod::Get.as_str(), "GET"); assert_eq!(RouteMethod::Delete.as_str(), "DELETE"); }
    #[test] fn empty_find() { let r = ApiRegistry::new(); assert!(r.find(&RouteMethod::Get, "/x").is_none()); }
}