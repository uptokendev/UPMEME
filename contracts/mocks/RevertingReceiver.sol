// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Helper that always reverts on receiving native value.
/// Used to prove fee receiver / vault cannot DOS core flows.
contract RevertingReceiver {
    receive() external payable {
        revert("NO_RECEIVE");
    }

    fallback() external payable {
        revert("NO_FALLBACK");
    }
}
