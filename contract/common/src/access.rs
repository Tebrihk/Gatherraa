#![no_std]
use soroban_sdk::{contracttype, Address, Env, Symbol};

#[derive(Clone)]
#[contracttype]
pub enum AccessKey {
    Admin,
    Role(Symbol, Address),
    Paused,
}

pub fn read_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&AccessKey::Admin)
}

pub fn write_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&AccessKey::Admin, admin);
}

pub fn has_role(env: &Env, role: Symbol, address: Address) -> bool {
    env.storage().persistent().has(&AccessKey::Role(role, address))
}

pub fn write_role(env: &Env, role: Symbol, address: Address) {
    env.storage().persistent().set(&AccessKey::Role(role, address), &true);
}

pub fn remove_role(env: &Env, role: Symbol, address: Address) {
    env.storage().persistent().remove(&AccessKey::Role(role, address));
}

pub fn is_paused(env: &Env) -> bool {
    env.storage().instance().get(&AccessKey::Paused).unwrap_or(false)
}

pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&AccessKey::Paused, &paused);
}

pub fn require_admin(env: &Env) -> Address {
    let admin = read_admin(env).unwrap_or_else(|| panic!("admin not set"));
    admin.require_auth();
    admin
}

pub fn require_role(env: &Env, role: Symbol, address: Address) {
    address.require_auth();
    if !has_role(env, role, address) {
        panic!("not authorized");
    }
}
