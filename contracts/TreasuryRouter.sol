// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TreasuryRouter {
    address public immutable admin;
    uint64  public immutable upgradeDelay;

    address public activeVault;

    address public pendingVault;
    uint64  public pendingSince;

    bool public forwardingPaused;

    event Forwarded(address indexed vault, uint256 amount);
    event ForwardFailed(address indexed vault, uint256 amount);
    event ForwardingPaused(bool paused);

    event VaultProposed(address indexed newVault, uint64 executeAfter);
    event VaultActivated(address indexed oldVault, address indexed newVault);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    constructor(address _admin, address _initialVault, uint64 _upgradeDelaySeconds) {
        require(_admin != address(0), "admin=0");
        require(_initialVault != address(0), "vault=0");
        require(_upgradeDelaySeconds >= 1 hours, "delay too small");
        admin = _admin;
        activeVault = _initialVault;
        upgradeDelay = _upgradeDelaySeconds;
    }

    receive() external payable {
        _forward(msg.value);
    }

    function forward() external {
        _forward(address(this).balance);
    }

    function _forward(uint256 amount) internal {
        if (forwardingPaused) return;
        if (amount == 0) return;

        address vault = activeVault;
        (bool ok, ) = payable(vault).call{value: amount}("");
        if (!ok) {
            emit ForwardFailed(vault, amount);
            return;
        }
        emit Forwarded(vault, amount);
    }

    function proposeVault(address newVault) external onlyAdmin {
        require(newVault != address(0), "vault=0");
        uint256 size;
        assembly { size := extcodesize(newVault) }
        require(size > 0, "not contract");

        pendingVault = newVault;
        pendingSince = uint64(block.timestamp);
        emit VaultProposed(newVault, uint64(block.timestamp) + upgradeDelay);
    }

    function acceptVault() external onlyAdmin {
        address newVault = pendingVault;
        require(newVault != address(0), "no pending");
        require(pendingSince != 0, "no pending");
        require(block.timestamp >= pendingSince + upgradeDelay, "delay");

        address old = activeVault;
        activeVault = newVault;

        pendingVault = address(0);
        pendingSince = 0;

        emit VaultActivated(old, newVault);
    }

    function setForwardingPaused(bool paused) external onlyAdmin {
        forwardingPaused = paused;
        emit ForwardingPaused(paused);
    }
}
