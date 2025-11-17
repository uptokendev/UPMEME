// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
// NOTE: OpenZeppelin removed the Counters library in version 5.x. We avoid
// importing Counters and instead track the launch ID with a simple
// uint256 counter. If using an older version of OpenZeppelin (<=4.9),
// Counters.sol can still be imported, but this contract does not rely on it.
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./TokenTemplate.sol";
import "./BondingCurveSale.sol";

/// @title LaunchIt Factory
/// @notice Deploys new token and sale contracts via minimal proxies (clones). The
/// factory wires roles and parameters, and emits events for off-chain indexers.
contract Factory is Ownable {
    // We no longer use OpenZeppelin's Counters library for tracking launch IDs.
    // Instead, we use a simple uint256 that increments with each new launch.
    using Clones for address;

    /// @notice Address of the token template implementation
    address public immutable tokenImpl;
    /// @notice Address of the sale implementation
    address public immutable saleImpl;
    /// @notice Tracks the number of launches created
    uint256 private _launchId;

    /// @notice Emitted when a new launch is created
    event LaunchCreated(
        uint256 indexed launchId,
        address indexed token,
        address indexed sale,
        bool externalToken,
        address creator
    );

    constructor(address _tokenImpl, address _saleImpl) {
        require(_tokenImpl != address(0) && _saleImpl != address(0), "impl zero");
        tokenImpl = _tokenImpl;
        saleImpl = _saleImpl;
    }

    /// @notice Creates a new token and sale using the provided parameters. The caller becomes the owner of both contracts.
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param initParams Sale initialization parameters
    function createLaunch(
        string calldata name,
        string calldata symbol,
        BondingCurveSale.InitParams calldata initParams
    ) external returns (address tokenAddr, address saleAddr) {
        require(initParams.token == address(0), "Token specified");
        // clone token and sale
        tokenAddr = tokenImpl.clone();
        saleAddr = saleImpl.clone();
        // initialize token
        TokenTemplate(tokenAddr).initialize(name, symbol, msg.sender);
        // grant sale minter role
        TokenTemplate(tokenAddr).grantMinter(saleAddr);
        // prepare sale parameters with new token
        BondingCurveSale.InitParams memory params = initParams;
        params.token = tokenAddr;
        // initialize sale (owner is msg.sender)
        BondingCurveSale(saleAddr).initialize(params);
        // run on-chain audit immediately for LaunchIt tokens (externalOk not required)
        BondingCurveSale(saleAddr).audit();
        BondingCurveSale(saleAddr).transferOwnership(msg.sender);
        // emit event
        _launchId += 1;
        emit LaunchCreated(_launchId, tokenAddr, saleAddr, false, msg.sender);
    }

    /// @notice Creates a sale for an existing external token. The token must satisfy external token rules.
    /// @param initParams Sale initialization parameters (token must be set)
    function createExternalSale(
        BondingCurveSale.InitParams calldata initParams
    ) external returns (address saleAddr) {
        require(initParams.token != address(0), "Token not set");
        saleAddr = saleImpl.clone();
        BondingCurveSale(saleAddr).initialize(initParams);
        BondingCurveSale(saleAddr).transferOwnership(msg.sender);
        // emit event
        _launchId += 1;
        emit LaunchCreated(_launchId, initParams.token, saleAddr, true, msg.sender);
    }
}