// SPDX-License-Identifier: MIT

pragma solidity 0.6.10;
pragma experimental "ABIEncoderV2";

import { BasketToken } from "./BasketToken.sol";
import { AddressArrayUtils } from "../lib/AddressArrayUtils.sol";


contract BasketCreator {
    address[] public baskets; 
    /* ============ Events ============ */

    event BasketTokenCreated(address indexed _basketToken, string _name, string _symbol);

    /**
     * Creates a SetToken smart contract and registers the SetToken with the controller. The SetTokens are composed
     * of positions that are instantiated as DEFAULT (positionState = 0) state.
     *
     * @param _components             List of addresses of components for initial Positions
     * @param _units                  List of units. Each unit is the # of components per 10^18 of a SetToken
     * @param _name                   Name of the SetToken
     * @param _symbol                 Symbol of the SetToken
     * @return address                Address of the newly created SetToken
     */
    function create(
        address[] memory _components,
        int256[] memory _units,
        string memory _name,
        string memory _symbol
    )
        external
        returns (address)
    {
        require(_components.length > 0, "Must have at least 1 component");
        require(_components.length == _units.length, "Component and unit lengths must be the same");

        for (uint256 i = 0; i < _components.length; i++) {
            require(_components[i] != address(0), "Component must not be null address");
            require(_units[i] > 0, "Units must be greater than 0");
        }

        // Creates a new BasketToken instance
        BasketToken basketToken = new BasketToken(
            _components,
            _units,
            _name,
            _symbol
        );

        baskets.push(address(basketToken));
        // Registers Set with controller
        emit BasketTokenCreated(address(basketToken), _name, _symbol);

        return address(basketToken);
    }
    
    function getBaskets()
        public
        view 
    returns (address[] memory)
    {
      return baskets;
    }
}