// SPDX-License-Identifier: MIT

pragma solidity 0.6.10;

import { VRFConsumerBase } from "@chainlink/contracts/src/v0.6/VRFConsumerBase.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IBasketToken } from "../interfaces/IBasketToken.sol";
import { PreciseUnitMath } from "../lib/PreciseUnitMath.sol";
import { AddressArrayUtils } from "../lib/AddressArrayUtils.sol";


contract BasketBroker is ReentrancyGuard, VRFConsumerBase {
  using SafeCast for uint256;
  using SafeCast for int256;
  using PreciseUnitMath for int256;
  using PreciseUnitMath for uint256;
  using Address for address;
  using AddressArrayUtils for address[];
  
  uint256 internal potPerc = 500;
  uint256 internal potFee = potPerc.preciseDiv(10000);
  
  // deployed token
  IERC20 public basketToken;
  
  // chainlink
  uint256 internal fee;
  bytes32 internal keyHash;

  // lottery vars
  uint256 public randomResult;
  bool lotteryOccurance = false;
  
  // owners / balances
  address[] public owners;
  address[] public lotteryEntries;
  mapping (address => uint256) private _balances;

  event BasketTokenIssued(
    address indexed _basketToken,
    address indexed _issuer,
    address indexed _to,
    uint256 _quantity
  );
    
  event BasketTokenRedeemed(
    address indexed _basketToken,
    address indexed _redeemer,
    address indexed _to,
    uint256 _quantity
  );

  event NoLottery(
    address indexed starter
  );

  event Lottery(
    address indexed starter,
    address indexed winner,
    uint256 winnings
  );
  
  constructor(
    IERC20 _basketToken,
    address _vrfCoordinator,
    address _linkToken,
    bytes32 _keyHash
  )
    public
    VRFConsumerBase(_vrfCoordinator, _linkToken)
  {
    basketToken = _basketToken;
    fee = 0.1 * 10 ** 18; // 0.1 LINK
    keyHash = _keyHash;
  }

  /* ============ Modifiers ============ */

  modifier lotteryActive() {
      require(lotteryOccurance);
      _;
  }

  /* ============ Basic Issuance Functions ============ */

  function issue(IBasketToken _basketToken,
                 uint256 _quantity,
                 address _to
  ) 
    internal
    nonReentrant
  {
    require(_quantity > 0, "Issue quantity must be > 0");
    (
        address[] memory components,
        uint256[] memory componentQuantities
    ) = getRequiredComponentUnitsForIssue(_basketToken, _quantity);

    // For each position, transfer the required underlying to the BasketToken
    for (uint256 i = 0; i < components.length; i++) {
        // Transfer the component to the BasketToken
        transferFrom(
          IERC20(components[i]),
          msg.sender,
          address(_basketToken),
          componentQuantities[i]
        );
    }

    // Mint the BasketToken
    _basketToken.mint(_to, _quantity);

    emit BasketTokenIssued(address(_basketToken), msg.sender, _to, _quantity);
  }

  /*
    * Redeems the BasketToken's positions and sends the components of the given
    * quantity to the caller. This function only handles Default Positions (positionState = 0).
    *
    * @param _basketToken             Instance of the BasketToken contract
    * @param _quantity                Quantity of the BasketToken to redeem
    * @param _to                      Address to send component assets to
    */
    function redeem(
        IBasketToken _basketToken,
        uint256 _quantity,
        address _to
    )
        internal
        nonReentrant
    {   
        // Reduce the redeemed amount by 5% to be left in the pot
        uint256 _potFee = _quantity.preciseMul(potFee);
        uint256 reducedQuantity = _quantity - _potFee;
        require(reducedQuantity > 0, "Redeem quantity must be > 0, after 5% fee");

        // Burn the BasketToken - ERC20's internal burn already checks that the user has enough balance
        _basketToken.burn(msg.sender, reducedQuantity);
        // Put the pot fee into the basket token holdings
        transferFrom(_basketToken, msg.sender, address(this), _potFee); 

        // For each position, invoke the BasketToken to transfer the tokens to the user
        address[] memory components = _basketToken.getComponents();
        for (uint256 i = 0; i < components.length; i++) {
            address component = components[i];
            
            uint256 unit = _basketToken.getDefaultPositionRealUnit(component).toUint256();

            // Use preciseMul to round down to ensure overcollateration when small redeem quantities are provided
            uint256 componentQuantity = _quantity.preciseMul(unit);

            // Instruct the BasketToken to transfer the component to the user
            strictInvokeTransfer(
                _basketToken,
                component,
                _to,
                componentQuantity
            );
        }

        emit BasketTokenRedeemed(address(_basketToken), msg.sender, _to, _quantity);
    }

  /* ============ External Getter Functions ============ */

  /**
      * Retrieves the addresses and units required to mint a particular quantity of BasketToken.
      *
      * @param _basketToken             Instance of the BasketToken to issue
      * @param _quantity                Quantity of BasketToken to issue
      * @return address[]               List of component addresses
      * @return uint256[]               List of component units required to issue the quantity of BasketTokens
      */
  function getRequiredComponentUnitsForIssue(
      IBasketToken _basketToken,
      uint256 _quantity
  )
      public
      view
      returns (address[] memory, uint256[] memory)
  {
      address[] memory components = _basketToken.getComponents();

      uint256[] memory notionalUnits = new uint256[](components.length);

      for (uint256 i = 0; i < components.length; i++) {
          notionalUnits[i] = _basketToken.getDefaultPositionRealUnit(components[i]).toUint256().preciseMulCeil(_quantity);
      }

      return (components, notionalUnits);
  }
    
  /* ============ ERC20 Transfer Functions ============ */
  
  /**
  * When given allowance, transfers a token from the "_from" to the "_to" of quantity "_quantity".
  * Ensures that the recipient has received the correct quantity (ie no fees taken on transfer)
  *
  * @param _token           ERC20 token to approve
  * @param _from            The account to transfer tokens from
  * @param _to              The account to transfer tokens to
  * @param _quantity        The quantity to transfer
  */

  function transferFrom(
      IERC20 _token,
      address _from,
      address _to,
      uint256 _quantity
  )
      internal
  {
    // Call specified ERC20 contract to transfer tokens (via proxy).
    if (_quantity > 0) {
        SafeERC20.safeTransferFrom(
            _token,
            _from,
            _to,
            _quantity
        );
    }
  }
    
  /* ================= Internal ================= */
  
  // Taken from invoke.sol helper from Set
  /**
    * Instructs the BasketToken to set approvals of the ERC20 token to a spender.
    *
    * @param _basketToken        BasketToken instance to invoke
    * @param _token           ERC20 token to approve
    * @param _spender         The account allowed to spend the BasketToken's balance
    * @param _quantity        The quantity of allowance to allow
    */
  function invokeApprove(
      IBasketToken _basketToken,
      address _token,
      address _spender,
      uint256 _quantity
  ) 
      external
  {
      bytes memory callData = abi.encodeWithSignature("approve(address,uint256)", _spender, _quantity);
      _basketToken.invoke(_token, 0, callData);
  }

  /**
    * Instructs the BasketToken to transfer the ERC20 token to a recipient.
    *
    * @param _basketToken        BasketToken instance to invoke
    * @param _token           ERC20 token to transfer
    * @param _to              The recipient account
    * @param _quantity        The quantity to transfer
    */
  function invokeTransfer(
      IBasketToken _basketToken,
      address _token,
      address _to,
      uint256 _quantity
  )
      internal
  {
      if (_quantity > 0) {
          bytes memory callData = abi.encodeWithSignature("transfer(address,uint256)", _to, _quantity);
          _basketToken.invoke(_token, 0, callData);
      }
  }

  /**
    * Instructs the BasketToken to transfer the ERC20 token to a recipient.
    * The new BasketToken balance must equal the existing balance less the quantity transferred
    *
    * @param _basketToken        BasketToken instance to invoke
    * @param _token              ERC20 token to transfer
    * @param _to                 The recipient account
    * @param _quantity           The quantity to transfer
    */
  function strictInvokeTransfer(
      IBasketToken _basketToken,
      address _token,
      address _to,
      uint256 _quantity
  )
      internal
  {
      if (_quantity > 0) {
          // Retrieve current balance of token for the BasketToken
          uint256 existingBalance = IERC20(_token).balanceOf(address(_basketToken));

          invokeTransfer(_basketToken, _token, _to, _quantity);

          // Get new balance of transferred token for BasketToken
          uint256 newBalance = IERC20(_token).balanceOf(address(_basketToken));
          
          // Verify only the transfer quantity is subtracted
          require(
              newBalance == existingBalance.sub(_quantity),
              "Invalid post transfer balance"
          );
      }
  }

  /*************** Buying and Redeeming Baskets *****************/

  /** Mint token to specific address
    *
    * @param _basketToken        BasketToken instance to mint
    * @param _quantity           The quantity to mint
    * @param _to                 The account doing the exchange
  */ 
  function mintBasketToken(IBasketToken _basketToken, 
                           uint256 _quantity, 
                           address _to) 
      external 
  {
      issue(_basketToken, _quantity, _to);
      uint256 entries = _quantity / 10**18;
      _balances[_to] += entries;
      owners.push(_to);
  }

  /** Redeem function (trade in Basket for whatever you traded in)
    * @param _basketToken        BasketToken instance to redeem
    * @param _quantity           The quantity to redeem
    * @param _to                 The account doing the exchange
  */
  function redeemFundsFromBasket(IBasketToken _basketToken,
                                 uint256 _quantity,
                                 address _to)
      external 
  {
      redeem(_basketToken, _quantity, _to);
      uint256 entries = _quantity / 10**18;
      _balances[_to] -= entries;
  }


/*************** Lottery *****************/

  function imFeelingLucky() 
      public
      payable
  {
      require(basketToken.balanceOf(address(this)) > 0, "No pot fee accrued for lottery yet");
      // Get random number from chainlink oracle
      getRandomNumber();
      // Set bool if 30% chance of lottery happening occurs
      lotteryChance();
      if (lotteryOccurance) {
          // Add lottery tickets to array for Basket owners
          populateLotteryTickets();
          // Shuffle array 
          shuffleLotteryTickets(1);
          address winner = lotteryEntries[0];
          // Transfer pot winnings to winner.
          SafeERC20.safeApprove(basketToken, address(this), basketToken.balanceOf(address(this)));
          transferFrom(basketToken, address(this), winner, basketToken.balanceOf(address(this)));
          emit Lottery(msg.sender, winner, basketToken.balanceOf(address(this)));
      } else {
          emit NoLottery(msg.sender);
          return;
      }
  }

  // Add weighted amount of tickets per user who owns Basket tokens
  function populateLotteryTickets()
      internal
  {
      delete lotteryEntries;
      for (uint i=0; i < owners.length; i++) {
          uint256 value = _balances[owners[i]];
          for (uint x=0; x < value; x++) {
              lotteryEntries.push(owners[i]);
          }
      }
  }

  // Shuffle lottery tickets to get random order 
  function shuffleLotteryTickets(uint256 numShuffles)
      internal
  {
  // Run Fisher-Yates shuffle
  for (uint256 i=0; i < numShuffles; i++) {
      uint256 randomIndex = i + randomResult % (lotteryEntries.length - i);
      address randomTmp = lotteryEntries[randomIndex];
      lotteryEntries[randomIndex] = lotteryEntries[i];
      lotteryEntries[i] = randomTmp;
    }
  }

  function getRandomNumber() 
      public 
  returns (bytes32 requestId) 
  {
      require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK - fill contract with faucet");
      return requestRandomness(keyHash, fee);
  }

  function fulfillRandomness(bytes32 requestId, 
                             uint256 randomness) 
      internal 
      override 
  {
    randomResult = randomness;
  }
  
  // Function to decide if we will have a lottery
  function lotteryChance() 
      internal
  returns (bool) 
  {
      uint256 chance = (randomResult % 10) + 1;
      if (chance <= 3) {
          lotteryOccurance = true;
      } else {
          lotteryOccurance = false;
      }
  }

  function getLotteryEntries()
      public
      view
  returns (address[] memory)
  {
      return lotteryEntries;
  }

}