const { ethers } = require("hardhat");
require('dotenv').config({path: ".env"})

const ERC20 = require("../artifacts/contracts/lib/Fake1ERC20.sol/Fake1ERC20.json");
const BASKETTOKEN = require("../artifacts/contracts/protocol/BasketToken.sol/BasketToken.json")

async function main() {

  / ================= Deploy =================== /
  
  const [owner, user1]  = await ethers.getSigners();
  provider = ethers.getDefaultProvider()
  
  const basketUnits = ethers.utils.parseEther("1");
  const deployAmount = ethers.utils.parseEther("1000")
  const allowance = ethers.utils.parseEther("100");
  
  const ERC1 = await ethers.getContractFactory("Fake1ERC20")
  e1 = await ERC1.connect(owner).deploy(deployAmount);
  await e1.deployed()
  console.log("Fake1ERC20 deployed to", e1.address);
  
  const ERC2 = await ethers.getContractFactory("Fake2ERC20")
  e2 = await ERC2.connect(owner).deploy(deployAmount);
  await e2.deployed()
  console.log("Fake2ERC20 deployed to", e2.address);

  const BasketCreator = await ethers.getContractFactory("BasketCreator");
  const bc = await BasketCreator.deploy();
  await bc.deployed();
  console.log("BasketCreator deployed to:", bc.address);

  const bcContract = await BasketCreator.attach(bc.address);
  const tx = await bcContract.create([e1.address, e2.address], [basketUnits, basketUnits], "BASKET", "BASKET")
  await tx.wait();
  let basketAddress = await bcContract.getBaskets();
  basketAddress = basketAddress[0]
  console.log("BasketToken generated at:", basketAddress);
  
  const BasketBroker = await ethers.getContractFactory("BasketBroker");
  const bb = await BasketBroker.deploy(basketAddress, "0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B", 
                                       "0x01BE23585060835E02B77ef475b0Cc51aA1e0709", "0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311")
  console.log("BasketBroker deployed at", bb.address)
  
  // ==================== Issue ======================= /

  const erc1 = new ethers.Contract(e1.address, ERC20.abi, owner);
  const ownerApprove1 = await erc1.connect(owner).approve(bb.address, allowance);
  ownerApprove1.wait();
  console.log("Approved Fake1ERC20");

  const erc2 = new ethers.Contract(e2.address, ERC20.abi, owner);
  const ownerApprove2 = await erc2.connect(owner).approve(bb.address, allowance);
  ownerApprove2.wait()
  console.log("Approved Fake2ERC20");
   
  await bb.mintBasketToken(basketAddress, ethers.utils.parseEther("50"), owner.address);
  console.log("Issued Basket token", basketAddress, "to", owner.address);
  await new Promise(r => setTimeout(r, 20000));
 
  // These variables are not reliable if the blocks have not confirmed, please refer to etherscan tx for details
  const basketToken = new ethers.Contract(basketAddress, BASKETTOKEN.abi, owner)
  const basketHoldings = await basketToken.balanceOf(owner.address);
  console.log("Owner's Basket holdings after issue:", ethers.utils.formatEther(basketHoldings.toString()));
  
  const erc1holdings = await erc1.balanceOf(owner.address);
  console.log("Owner's Fake1ERC20 holdings after issue:", ethers.utils.formatEther(erc1holdings.toString()));
  
  const erc2holdings = await erc2.balanceOf(owner.address);
  console.log("Owner's Fake2ERC20 holdings after issue:", ethers.utils.formatEther(erc2holdings.toString()));

  / =============== Redeem ================== /

  const bApprove = await basketToken.connect(owner).approve(bb.address, allowance);
  bApprove.wait();
  await new Promise(r => setTimeout(r, 20000));

  await bb.redeemFundsFromBasket(basketAddress, ethers.utils.parseEther("25"), owner.address);
  console.log(owner.address, "Redeemed Basket tokens");
  await new Promise(r => setTimeout(r, 20000));

  // These variables are not reliable if the blocks have not confirmed, please refer to etherscan tx for details
  const newBasketHoldings = await basketToken.balanceOf(owner.address);
  console.log("Owner's Basket holdings after redeeming 25 Baskets:", ethers.utils.formatEther(newBasketHoldings.toString()));
  
  const newErc1holdings = await erc1.balanceOf(owner.address);
  console.log("Owner's Fake1ERC20 holdings after redeeming 25 Baskets:", ethers.utils.formatEther(newErc1holdings.toString()));
  
  const newErc2holdings = await erc2.balanceOf(owner.address);
  console.log("Owner's Fake2ERC20 holdings after redeeming 25 Baskets:", ethers.utils.formatEther(newErc2holdings.toString()));

  const basketContractHoldings = await basketToken.balanceOf(bb.address);
  console.log("The contract currently owns:", ethers.utils.formatEther(basketContractHoldings.toString()), "Basket tokens in the pot");

}


main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});
