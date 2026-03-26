#![no_std]
use soroban_sdk::{Address, BytesN, Env, Symbol};
use crate::access::require_admin;
use crate::storage::CommonDataKey;

pub fn schedule_upgrade(env: &Env, new_wasm_hash: BytesN<32>, unlock_time: u64) {
    require_admin(env);

    if env.ledger().timestamp() >= unlock_time {
        panic!("unlock_time must be in the future");
    }

    env.storage().instance().set(
        &CommonDataKey::UpgradeTimelock,
        &(new_wasm_hash.clone(), unlock_time),
    );

    env.events().publish(
        (Symbol::new(env, "UpgradeScheduled"),),
        (new_wasm_hash, unlock_time),
    );
}

pub fn execute_upgrade(env: &Env, new_wasm_hash: BytesN<32>) {
    require_admin(env);

    let (scheduled_hash, unlock_time): (BytesN<32>, u64) = env
        .storage()
        .instance()
        .get(&CommonDataKey::UpgradeTimelock)
        .unwrap_or_else(|| panic!("no upgrade scheduled"));

    if scheduled_hash != new_wasm_hash {
        panic!("wasm hash does not match scheduled");
    }
    if env.ledger().timestamp() < unlock_time {
        panic!("timelock not expired");
    }

    env.storage().instance().remove(&CommonDataKey::UpgradeTimelock);
    env.deployer().update_current_contract_wasm(new_wasm_hash.clone());

    env.events().publish((Symbol::new(env, "Upgraded"),), new_wasm_hash);
}
