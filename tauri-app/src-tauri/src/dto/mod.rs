//! DTOs (Data Transfer Objects): JSON-Verträge zwischen Backend-Commands und React-UI.
//!
//! Interne DB-Structs (`rustime-db`) werden in Commands auf DTOs gemappt;
//! das Frontend sieht nur diese serialisierbaren Typen.

pub mod activity;
pub mod export;
pub mod project;
pub mod stats;
