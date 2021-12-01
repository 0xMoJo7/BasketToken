const { ethers } = require("hardhat");
require('dotenv').config({path: ".env"})

async function main() {

  const [owner, user1]  = await ethers.getSigners();
  provider = ethers.getDefaultProvider()
  
  const basketUnits = ethers.utils.parseEther("1");
  const deployAmount = ethers.utils.parseEther("1000")
  
  const ERC1 = await ethers.getContractFactory("Fake1ERC20")
  e1 = await ERC1.connect(owner).deploy(deployAmount);
  await e1.deployed()
  console.log("Fake1ERC201 deployed to", e1.address);
 
  const ERC2 = await ethers.getContractFactory("Fake2ERC20")
  e2 = await ERC2.connect(owner).deploy(deployAmount);
  await e2.deployed()
  console.log("Fake2ERC20 deployed to", e2.address);

  const BasketCreator = await ethers.getContractFactory("BasketCreator");
  const bc = await BasketCreator.deploy();
  await bc.deployed();
  console.log("BasketCreator deployed to:", bc.address);

  const bcContract = await BasketCreator.attach(bc.address);
  const tx = await bcContract.create([e1.address, e2.address], [basketUnits, basketUnits], "basketToken", "basketToken")
  await tx.wait();
  let basketAddress = await bcContract.getBaskets();
  basketAddress = basketAddress[0]
  console.log("BasketToken generated at:", basketAddress);
  
  const BasketBroker = await ethers.getContractFactory("BasketBroker");
  const bb = await BasketBroker.deploy(basketAddress, "0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B", 
                                       "0x01BE23585060835E02B77ef475b0Cc51aA1e0709", "0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311")
  console.log("BasketBroker deployed at", bb.address);

}


main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});