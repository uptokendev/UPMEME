// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @dev Minimal Pancake Router interface to add liquidity with BNB. This interface
/// is intentionally slim to avoid pulling in all router functions.
interface IPancakeRouter02 {
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
}