#![no_std]
use soroban_sdk::{symbol_short, Env, Symbol};

const REENTRANCY_GUARD: Symbol = symbol_short!("reentrant");

pub fn set_reentrancy_guard(env: &Env) {
    if env.storage().instance().has(&REENTRANCY_GUARD) {
        panic!("reentrant call detected");
    }
    env.storage().instance().set(&REENTRANCY_GUARD, &true);
}

pub fn remove_reentrancy_guard(env: &Env) {
    env.storage().instance().remove(&REENTRANCY_GUARD);
}
