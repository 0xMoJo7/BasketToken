const { ethers } = require("hardhat");
require('dotenv').config({path: ".env"})

const ERC20 = require("../artifacts/contracts/lib/Fake1ERC20.sol/Fake1ERC20.json");
const ERC1_ADDRESS = "0x5a8c0f2ff92acE40f0238642Ae6D028B5B3e72ab"
const ERC2_ADDRESS = "0x27F4dd1E1037E21d7F805F7115d2c97d57c1307C"
const BASKET_TOKEN_ADDRESS = "0xDe3a61805E25cB58a04F03E0fdd0e023541D3629"
const BASKET_BROKER_ADDRESS = "0x578e3591fFa88bA5c32116924A264BF63414FE12"

async function main() {

  const [owner, user1]  = await ethers.getSigners();
  provider = ethers.getDefaultProvider()

  const allowance = ethers.utils.parseEther("100");

  // Need more than one user to have a lottery
  const erc1 = new ethers.Contract(ERC1_ADDRESS, ERC20.abi, owner);
  const erc2 = new ethers.Contract(ERC2_ADDRESS, ERC20.abi, owner);
  await erc1.connect(owner).transfer(user1.address, ethers.utils.parseEther("10"));
  await erc2.connect(owner).transfer(user1.address, ethers.utils.parseEther("10"));
  console.log("Funds transferred from owner to user1");
  await new Promise(r => setTimeout(r, 20000));
  
  const user1erc1 = new ethers.Contract(ERC1_ADDRESS, ERC20.abi, user1);
  const user1erc2 = new ethers.Contract(ERC2_ADDRESS, ERC20.abi, user1);
  owner1erc1balance = await user1erc1.balanceOf(user1.address);
  console.log(ethers.utils.formatEther(owner1erc1balance.toString()))
  await user1erc1.connect(user1).approve(BASKET_BROKER_ADDRESS, ethers.utils.parseEther("10"))
  await user1erc2.connect(user1).approve(BASKET_BROKER_ADDRESS, ethers.utils.parseEther("10"))
  await new Promise(r => setTimeout(r, 20000));
  console.log("User1 approved the fake tokens");

  const BasketBroker = await ethers.getContractFactory("BasketBroker");
  const bb = await BasketBroker.attach(BASKET_BROKER_ADDRESS);

  await bb.mintBasketToken(BASKET_TOKEN_ADDRESS, ethers.utils.parseEther("10"), user1.address);
  console.log("User1 now owns 10 Basket tokens")

  await bb.imFeelingLucky();

  const lottoEntries = await bb.getLotteryEntries();
  console.log(lottoEntries);

}

main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});