const { ethers } = require("hardhat");
require('dotenv').config({path: ".env"})

const ERC20 = require("../artifacts/contracts/lib/Fake1ERC20.sol/Fake1ERC20.json");
const BASKETTOKEN = require("../artifacts/contracts/protocol/BasketToken.sol/BasketToken.json")
const ERC1_ADDRESS = "0x5a8c0f2ff92acE40f0238642Ae6D028B5B3e72ab"
const ERC2_ADDRESS = "0x27F4dd1E1037E21d7F805F7115d2c97d57c1307C"
const BASKET_TOKEN_ADDRESS = "0xDe3a61805E25cB58a04F03E0fdd0e023541D3629"
const BASKET_BROKER_ADDRESS = "0x578e3591fFa88bA5c32116924A264BF63414FE12"


async function main() {

  const [owner, user1]  = await ethers.getSigners();
  provider = ethers.getDefaultProvider()

  const allowance = ethers.utils.parseEther("100");

  const erc1 = new ethers.Contract(ERC1_ADDRESS, ERC20.abi, owner);
  const ownerApprove1 = await erc1.connect(owner).approve(BASKET_BROKER_ADDRESS, allowance);
  ownerApprove1.wait();
  console.log("Approved Fake1ERC20");

  const erc2 = new ethers.Contract(ERC2_ADDRESS, ERC20.abi, owner);
  const ownerApprove2 = await erc2.connect(owner).approve(BASKET_BROKER_ADDRESS, allowance);
  ownerApprove2.wait()
  console.log("Approved Fake2ERC20");

  const BasketBroker = await ethers.getContractFactory("BasketBroker");
  const bb = await BasketBroker.attach(BASKET_BROKER_ADDRESS)
   
  await bb.mintBasketToken(BASKET_TOKEN_ADDRESS, ethers.utils.parseEther("50"), owner.address);
  console.log("Issued Basket token", BASKET_TOKEN_ADDRESS, "to", owner.address);
  await new Promise(r => setTimeout(r, 20000));
 
  // These variables are not reliable if the blocks have not confirmed, please refer to etherscan tx for details
  const basketToken = new ethers.Contract(BASKET_TOKEN_ADDRESS, BASKETTOKEN.abi, owner)
  const basketHoldings = await basketToken.balanceOf(owner.address);
  console.log("Owner's Basket holdings after issue:", ethers.utils.formatEther(basketHoldings.toString()));
  
  const erc1holdings = await erc1.balanceOf(owner.address);
  console.log("Owner's Fake1ERC20 holdings after issue:", ethers.utils.formatEther(erc1holdings.toString()));
  
  const erc2holdings = await erc2.balanceOf(owner.address);
  console.log("Owner's Fake2ERC20 holdings after issue:", ethers.utils.formatEther(erc2holdings.toString()));

}


main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});