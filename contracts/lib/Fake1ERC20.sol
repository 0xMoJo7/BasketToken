pragma solidity 0.6.10;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Fake1ERC20 is ERC20 {
    constructor(uint256 initialSupply) public ERC20("Fake1ERC20", "F1") {
        _mint(msg.sender, initialSupply);
    }
}