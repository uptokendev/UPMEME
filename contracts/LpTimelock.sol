// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title LP Timelock
/// @notice Minimal timelock contract for LP tokens. Tokens are locked until
/// the specified release time, after which the beneficiary can withdraw them.
contract LpTimelock {
    IERC20 public immutable token;
    address public immutable beneficiary;
    uint256 public immutable releaseTime;

    constructor(IERC20 _token, address _beneficiary, uint256 _releaseTime) {
        require(_releaseTime > block.timestamp, "Release before now");
        token = _token;
        beneficiary = _beneficiary;
        releaseTime = _releaseTime;
    }

    /// @notice Transfers locked tokens to beneficiary after release time
    function release() external {
        require(block.timestamp >= releaseTime, "Not released");
        uint256 amount = token.balanceOf(address(this));
        require(amount > 0, "No tokens");
        token.transfer(beneficiary, amount);
    }
}