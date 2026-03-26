#![no_std]
use soroban_sdk::{contracttype, Env};

pub const TTL_INSTANCE: u32 = 17280 * 30; // 30 days
pub const TTL_PERSISTENT: u32 = 17280 * 90; // 90 days

#[derive(Clone)]
#[contracttype]
pub enum CommonDataKey {
    Version,
    UpgradeTimelock,
}

pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_INSTANCE, TTL_INSTANCE);
}

pub fn read_version(env: &Env) -> u32 {
    env.storage().instance().get(&CommonDataKey::Version).unwrap_or(1)
}

pub fn write_version(env: &Env, version: u32) {
    env.storage().instance().set(&CommonDataKey::Version, &version);
}
