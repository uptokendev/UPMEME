// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TreasuryVault {
    address public immutable multisig;

    event Withdraw(address indexed to, uint256 amount);

    constructor(address _multisig) {
        require(_multisig != address(0), "multisig=0");
        multisig = _multisig;
    }

    receive() external payable {}

    function withdraw(address payable to, uint256 amount) external {
        require(msg.sender == multisig, "not multisig");
        require(to != address(0), "to=0");
        require(amount <= address(this).balance, "insufficient");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "transfer failed");
        emit Withdraw(to, amount);
    }
}
