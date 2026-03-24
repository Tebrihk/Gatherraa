use soroban_sdk::{contracttype, Address, Vec, String};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    TimelockDuration,
    EmergencyAddress,
    Proposal(u32),
    ProposalCount,
    Vote(u32, Address), // (ProposalID, Voter)
    UserDelegation(Address), // User -> Delegatee
    UserVotesRevoked(u32, Address),
    CategorySettings(u32), // CategoryID -> CategorySettings
}

#[derive(Clone)]
#[contracttype]
pub struct CategorySettings {
    pub quorum: i128,      // Minimum votes required for proposal to be valid
    pub threshold: u32,   // Percentage of 'for' votes needed (e.g. 51, 66)
    pub voting_period: u32, // Number of blocks/ledgers
}


#[derive(Clone)]
#[contracttype]
pub enum GovernanceAction {
    Upgrade(String), // New WASM hash
    FeeChange(u32),  // New fee in basis points
    ParameterChange(String, u32), // Param name, new value
    EmergencyAction,
}

#[derive(Clone)]
#[contracttype]
pub enum ProposalCategory {
    ProtocolUpgrade,
    FeeAdjustment,
    ParameterUpdate,
    Emergency,
}

#[derive(Clone)]
#[contracttype]
pub enum ProposalStatus {
    Pending,
    Active,
    Defeated,
    Succeeded,
    Queued,
    Executed,
    Canceled,
    Expired,
}

#[derive(Clone)]
#[contracttype]
pub struct Proposal {
    pub id: u32,
    pub proposer: Address,
    pub action: GovernanceAction,
    pub category: ProposalCategory,
    pub description: String,
    pub start_ledger: u32,
    pub end_ledger: u32,
    pub total_votes_for: i128,
    pub total_votes_against: i128,
    pub status: ProposalStatus,
    pub eta: u64, // Estimated time for execution after queuing
}

#[derive(Clone)]
#[contracttype]
pub struct VoteRecord {
    pub voter: Address,
    pub support: bool,
    pub amount: i128,
    pub is_quadratic: bool,
}
#[soroban_sdk::contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GovernanceError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ProposalNotFound = 4,
    InvalidProposal = 5,
    VotingEnded = 6,
    InsufficientBalance = 7,
    InvalidAmount = 8,
    AlreadyVoted = 9,
    NotDelegatee = 10,
    InvalidDelegatee = 11,
    VotingStillActive = 12,
    ProposalNotQueued = 13,
    TimelockNotExpired = 14,
    CategorySettingsNotFound = 15,
    ArithmeticError = 16,
}
