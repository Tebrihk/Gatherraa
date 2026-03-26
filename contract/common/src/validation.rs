#![no_std]
use soroban_sdk::{Address, BytesN, Env, token};

/// Validates that an address is not zero
pub fn validate_address(env: &Env, address: &Address) {
    if address == &Address::from_contract_id(&BytesN::from_array(env, &[0; 32])) {
        panic!("zero address not allowed");
    }
}

/// Validates that an address points to a deployed token contract
pub fn validate_token_address(env: &Env, address: &Address) {
    validate_address(env, address);
    let token_client = token::Client::new(env, address);
    let _ = token_client.decimals();
}
