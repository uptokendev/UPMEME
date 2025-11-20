// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract LaunchToken is ERC20, Ownable {
    uint256 public immutable cap;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 cap_,
        address owner_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        require(cap_ > 0, "cap is zero");
        require(owner_ != address(0), "owner is zero");
        cap = cap_;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "to zero");
        require(totalSupply() + amount <= cap, "cap exceeded");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}
