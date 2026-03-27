#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger, LedgerInfo};
use soroban_sdk::{token, Address, Env, Vec};

#[test]
fn test_governance_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let emergency = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::StellarAssetClient::new(&env, &token_addr);

    token_client.mint(&proposer, &500);
    token_client.mint(&voter1, &1000);
    token_client.mint(&voter2, &200);

    let contract_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &contract_id);

    client.init(&admin, &token_addr, &100, &emergency);

    let action = GovernanceAction::ParameterChange(String::from_str(&env, "fee"), 50);
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::ParameterUpdate,
        &String::from_str(&env, "Increase fee to 50 bps")
    );

    assert_eq!(prop_id, 1);

    client.vote(&voter1, &prop_id, &true, &false, &Vec::new(&env));
    client.vote(&voter2, &prop_id, &false, &false, &Vec::new(&env));

    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp(),
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 101,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
        min_persistent_entry_ttl: 1000,
        min_temp_entry_ttl: 1000,
    });

    client.queue(&prop_id);

    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + 101,
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 1,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
        min_persistent_entry_ttl: 1000,
        min_temp_entry_ttl: 1000,
    });

    client.execute(&prop_id);
    
    let prop = client.get_proposal(&prop_id);
    if let ProposalStatus::Executed = prop.status {} else {
        panic!("Proposal should be executed");
    }
}

#[test]
fn test_quadratic_voting() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let emergency = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::StellarAssetClient::new(&env, &token_addr);

    token_client.mint(&proposer, &500);
    token_client.mint(&voter, &400); 

    let contract_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &contract_id);

    client.init(&admin, &token_addr, &100, &emergency);

    let action = GovernanceAction::FeeChange(100);
    let prop_id = client.create_proposal(&proposer, &action, &ProposalCategory::FeeAdjustment, &String::from_str(&env, "Desc"));

    client.vote(&voter, &prop_id, &true, &true, &Vec::new(&env));

    client.set_category_settings(&1, &20, &50, &50);
    
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp(),
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 51,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
        min_persistent_entry_ttl: 1000,
        min_temp_entry_ttl: 1000,
    });

    client.queue(&prop_id); 
    let prop = client.get_proposal(&prop_id);
    if let ProposalStatus::Queued = prop.status {} else {
        panic!("Proposal should be queued, power was {}", prop.total_votes_for);
    }
}

#[test]
fn test_delegation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let emergency = Address::generate(&env);
    let proposer = Address::generate(&env);
    let delegator = Address::generate(&env);
    let delegatee = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::StellarAssetClient::new(&env, &token_addr);

    token_client.mint(&proposer, &500);
    token_client.mint(&delegator, &1000);
    token_client.mint(&delegatee, &100);

    let contract_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &contract_id);

    client.init(&admin, &token_addr, &100, &emergency);

    client.delegate(&delegator, &delegatee);

    let action = GovernanceAction::FeeChange(100);
    let prop_id = client.create_proposal(&proposer, &action, &ProposalCategory::FeeAdjustment, &String::from_str(&env, "Desc"));

    let mut delegators = Vec::new(&env);
    delegators.push_back(delegator.clone());
    client.vote(&delegatee, &prop_id, &true, &false, &delegators);
    
    client.set_category_settings(&1, &1100, &50, &50);
    
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp(),
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 51,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
        min_persistent_entry_ttl: 1000,
        min_temp_entry_ttl: 1000,
    });
    
    client.queue(&prop_id);
    let prop = client.get_proposal(&prop_id);
    if let ProposalStatus::Queued = prop.status {} else {
        panic!("Proposal should be queued");
    }
}

#[test]
fn test_double_vote_guard() {
    // Voting twice for the same proposal should not double-count power.
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let emergency = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::StellarAssetClient::new(&env, &token_addr);

    token_client.mint(&proposer, &500);
    token_client.mint(&voter, &300);

    let contract_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &contract_id);
    client.init(&admin, &token_addr, &100, &emergency);

    let action = GovernanceAction::FeeChange(10);
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::FeeAdjustment,
        &String::from_str(&env, "Desc"),
    );

    // Vote once
    client.vote(&voter, &prop_id, &true, &false, &Vec::new(&env));
    let prop_after_first = client.get_proposal(&prop_id);
    let votes_after_first = prop_after_first.total_votes_for;

    // Vote again — should be a no-op (guard prevents double counting)
    client.vote(&voter, &prop_id, &true, &false, &Vec::new(&env));
    let prop_after_second = client.get_proposal(&prop_id);

    assert_eq!(
        prop_after_second.total_votes_for, votes_after_first,
        "Double vote should not increase total power"
    );
}

#[test]
fn test_queue_defeated_below_quorum() {
    // Proposals with total votes below quorum should always be Defeated.
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let emergency = Address::generate(&env);
    let proposer = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::StellarAssetClient::new(&env, &token_addr);
    token_client.mint(&proposer, &500);

    let contract_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &contract_id);
    client.init(&admin, &token_addr, &100, &emergency);

    let action = GovernanceAction::FeeChange(10);
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::FeeAdjustment,
        &String::from_str(&env, "Desc"),
    );

    // No votes cast — total is 0, which is below any quorum

    use soroban_sdk::testutils::LedgerInfo;
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp(),
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 51,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
        min_persistent_entry_ttl: 1000,
        min_temp_entry_ttl: 1000,
    });

    client.queue(&prop_id);
    let prop = client.get_proposal(&prop_id);
    if let ProposalStatus::Defeated = prop.status {} else {
        panic!("Proposal should be Defeated when below quorum");
    }
}

#[test]
fn test_queue_defeated_below_threshold() {
    // Meets quorum but NOT the approval threshold -> Defeated.
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let emergency = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter_for = Address::generate(&env);
    let voter_against = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::StellarAssetClient::new(&env, &token_addr);
    token_client.mint(&proposer, &500);
    token_client.mint(&voter_for, &200);
    token_client.mint(&voter_against, &400);

    let contract_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &contract_id);
    client.init(&admin, &token_addr, &100, &emergency);

    // Lower quorum so both voters push past it
    client.set_category_settings(&1, &100, &50, &50);

    let action = GovernanceAction::FeeChange(10);
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::FeeAdjustment,
        &String::from_str(&env, "Desc"),
    );

    client.vote(&voter_for, &prop_id, &true, &false, &Vec::new(&env));   // 200 for
    client.vote(&voter_against, &prop_id, &false, &false, &Vec::new(&env)); // 400 against

    use soroban_sdk::testutils::LedgerInfo;
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp(),
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 51,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
        min_persistent_entry_ttl: 1000,
        min_temp_entry_ttl: 1000,
    });

    client.queue(&prop_id);
    let prop = client.get_proposal(&prop_id);
    if let ProposalStatus::Defeated = prop.status {} else {
        panic!("Proposal should be Defeated when below approval threshold");
    }
}

#[test]
fn test_emergency_procedures() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let emergency = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin.clone());

    let contract_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &contract_id);

    client.init(&admin, &token_addr, &100, &emergency);

    let action = GovernanceAction::EmergencyAction;
    client.emergency_action(&emergency, &action);
}
