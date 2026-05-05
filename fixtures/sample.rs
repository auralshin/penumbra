// Penumbra fixture — Rust (tint: orange)
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct User {
    pub id: u32,
    pub name: String,
    pub active: bool,
}

#[derive(Debug)]
pub enum GreetError {
    Inactive,
    Empty,
}

impl User {
    pub fn greet(&self) -> Result<String, GreetError> {
        if !self.active {
            return Err(GreetError::Inactive);
        }
        if self.name.is_empty() {
            return Err(GreetError::Empty);
        }
        Ok(format!("Hello, {}", self.name))
    }
}

fn main() {
    let users: Vec<User> = vec![
        User { id: 1, name: "Ada".into(),   active: true  },
        User { id: 2, name: "Grace".into(), active: false },
    ];

    let mut tally: HashMap<bool, u32> = HashMap::new();
    for u in &users {
        *tally.entry(u.active).or_insert(0) += 1;
    }
    println!("{:#?}", tally);
}
