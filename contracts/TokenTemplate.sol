// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title TokenTemplate
/// @notice Minimal ERC20 implementation used by the LaunchIt platform.
/// This token is mintable and burnable by the bonding curve sale contract via the
/// MINTER_ROLE. Ownership of the token can be transferred to a multisig for
/// additional security.
///
/// The decimals are fixed at 18 to conform to the BEP-20 standard where most
/// tokens use 18 decimal places for divisibility【100511222850579†L130-L134】【164602888989104†L153-L156】.
contract TokenTemplate is ERC20Burnable, Ownable, AccessControl {
    // role that allows minting tokens; granted to BondingCurveSale
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Emitted when the minter role is permanently revoked
    event MinterRevoked(address sale);

    /// @dev decimals fixed at 18
    uint8 private constant _DECIMALS = 18;

    // custom variables for name and symbol since ERC20 stores them as private in the base contract
    string private _tokenName;
    string private _tokenSymbol;

    constructor() ERC20("", "") {
        // disable initialization here; expect initialize() to be called after clone
    }

    /// @notice Initializes the token with a name and symbol and transfers ownership
    /// @param name_ The token name
    /// @param symbol_ The token symbol
    /// @param owner_ The address that will own the token (multisig)
    function initialize(string memory name_, string memory symbol_, address owner_) external {
        require(owner() == address(0), "Already initialized");
        _transferOwnership(owner_);
        _setupRole(DEFAULT_ADMIN_ROLE, owner_);
        _setupRole(MINTER_ROLE, owner_); // allow owner to mint until sale starts
        _tokenName = name_;
        _tokenSymbol = symbol_;
    }

    /// @notice Returns the token decimals (18)
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Returns the name of the token
    function name() public view virtual override returns (string memory) {
        return _tokenName;
    }

    /// @notice Returns the symbol of the token
    function symbol() public view virtual override returns (string memory) {
        return _tokenSymbol;
    }

    /// @notice Mints tokens to an address. Can only be called by addresses with MINTER_ROLE.
    function mint(address to, uint256 amount) external {
        require(hasRole(MINTER_ROLE, msg.sender), "Not minter");
        _mint(to, amount);
    }

    /// @notice Allows the owner or sale to revoke the minter role permanently.
    function revokeMinter(address sale) external onlyOwner {
        // revoke both sale and owner minter roles to freeze supply
        if (hasRole(MINTER_ROLE, sale)) {
            _revokeRole(MINTER_ROLE, sale);
        }
        if (hasRole(MINTER_ROLE, msg.sender)) {
            _revokeRole(MINTER_ROLE, msg.sender);
        }
        emit MinterRevoked(sale);
    }

    /// @notice Grants minter role to a bonding curve sale contract.
    function grantMinter(address sale) external onlyOwner {
        _grantRole(MINTER_ROLE, sale);
    }
}