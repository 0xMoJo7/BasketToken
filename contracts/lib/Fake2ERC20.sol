pragma solidity 0.6.10;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Fake2ERC20 is ERC20 {
    constructor(uint256 initialSupply) public ERC20("Fake2ERC20", "F2") {
        _mint(msg.sender, initialSupply);
    }
}