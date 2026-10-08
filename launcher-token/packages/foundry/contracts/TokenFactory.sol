// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Capped } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";

/// @notice Creation-only token. Trading is unavailable in this release; no mint authority exists.
/// Future market-maker releases require a separately reviewed deployment, never an upgrade to this token.
contract LauncherToken is ERC20Capped {
    address public immutable launcher;
    address public immutable launcherRecipient;
    address public immutable platformRecipient;
    bytes32 public constant PRESET = keccak256("ETH_LINEAR_V1");
    uint256 public constant START_PRICE_WEI = 1e12;
    uint256 public constant SLOPE_WEI_PER_TOKEN = 18e6;
    uint256 public constant TRADING_FEE_BPS = 100;
    uint256 public constant SLIPPAGE_BPS = 100;
    uint256 public constant QUOTE_LIFETIME = 300;

    constructor(
        string memory name_,
        string memory symbol_,
        address launcher_,
        address launcherRecipient_,
        address platformRecipient_
    ) ERC20(name_, symbol_) ERC20Capped(1_000_000e18) {
        launcher = launcher_;
        launcherRecipient = launcherRecipient_;
        platformRecipient = platformRecipient_;
    }
}

/// @notice Reviews bind a proposal to exact metadata, disclosures and both recipient roles.
contract TokenFactory is Ownable {
    struct Proposal {
        address launcher;
        address launcherRecipient;
        bytes32 terms;
        bytes32 revision;
        bool approved;
        address token;
    }
    address public immutable platformRecipient;
    mapping(address => bool) public approvedLaunchers;
    mapping(bytes32 => Proposal) public proposals;
    mapping(address => bytes32) public proposalOf;
    address[] private tokens;
    error InvalidProposal();
    error UnauthorizedLauncher();
    error InvalidInput();
    event LauncherApproval(
        address indexed launcher, bool approved, address indexed actor, uint256 timestamp, string reason
    );
    event ProposalReview(
        bytes32 indexed proposal,
        address indexed launcher,
        bytes32 indexed revision,
        bytes32 terms,
        address launcherRecipient,
        address platformRecipient,
        bool approved,
        address actor,
        uint256 timestamp,
        string reason
    );
    event TokenCreated(
        address indexed token,
        address indexed launcher,
        bytes32 indexed proposal,
        bytes32 revision,
        address launcherRecipient,
        address platformRecipient,
        bytes32 preset,
        uint256 chainId
    );

    constructor(address operator, address platformRecipient_) Ownable(operator) {
        if (platformRecipient_ == address(0)) revert InvalidInput();
        platformRecipient = platformRecipient_;
    }

    function setLauncherApproval(address launcher, bool approved, string calldata reason) external onlyOwner {
        if (launcher == address(0) || bytes(reason).length == 0) revert InvalidInput();
        approvedLaunchers[launcher] = approved;
        emit LauncherApproval(launcher, approved, msg.sender, block.timestamp, reason);
    }

    function reviewProposal(
        bytes32 id,
        address launcher,
        string calldata name,
        string calldata symbol,
        bytes32 revision,
        address recipient,
        bool approved,
        string calldata reason
    ) external onlyOwner {
        if (
            id == bytes32(0) || revision == bytes32(0) || launcher == address(0) || recipient == address(0)
                || bytes(name).length == 0 || bytes(name).length > 64 || bytes(symbol).length == 0
                || bytes(symbol).length > 12 || bytes(reason).length == 0 || proposals[id].token != address(0)
        ) revert InvalidInput();
        bytes32 terms = keccak256(abi.encode(launcher, name, symbol, revision, recipient, platformRecipient));
        proposals[id] = Proposal(launcher, recipient, terms, revision, approved, address(0));
        emit ProposalReview(
            id, launcher, revision, terms, recipient, platformRecipient, approved, msg.sender, block.timestamp, reason
        );
    }

    function createToken(bytes32 id, string calldata name, string calldata symbol, bytes32 revision)
        external
        returns (address token)
    {
        Proposal storage proposal = proposals[id];
        if (!approvedLaunchers[msg.sender] || msg.sender != proposal.launcher) revert UnauthorizedLauncher();
        if (
            !proposal.approved || proposal.token != address(0)
                || proposal.terms
                    != keccak256(
                        abi.encode(msg.sender, name, symbol, revision, proposal.launcherRecipient, platformRecipient)
                    )
        ) revert InvalidProposal();
        token = address(new LauncherToken(name, symbol, msg.sender, proposal.launcherRecipient, platformRecipient));
        proposal.token = token;
        proposal.approved = false;
        proposalOf[token] = id;
        tokens.push(token);
        emit TokenCreated(
            token,
            msg.sender,
            id,
            revision,
            proposal.launcherRecipient,
            platformRecipient,
            LauncherToken(token).PRESET(),
            block.chainid
        );
    }

    function tokenCount() external view returns (uint256) {
        return tokens.length;
    }

    function tokenAt(uint256 index) external view returns (address) {
        return tokens[index];
    }
}
