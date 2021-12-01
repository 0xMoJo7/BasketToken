const { expect } = require("chai");
const { providers } = require("ethers");
const { ethers } = require("hardhat");

const ERC20 = require("../artifacts/contracts/lib/Fake1ERC20.sol/Fake1ERC20.json");
const BASKETTOKEN = require("../artifacts/contracts/protocol/BasketToken.sol/BasketToken.json")

describe("BasketBroker", function () {
  let BasketFactory, deployAdress, bfContract
  it("Should issue and redeem set tokens", async function () {
    const [owner, user1]  = await ethers.getSigners();
    provider = ethers.getDefaultProvider()
    
    const basketUnits = "1000000000000000000"
    const deployAmount = "100000000000000000000"
    const allowance = "10000000000000000000"
    
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
    const tx = await bcContract.create([e1.address, e2.address], [basketUnits, basketUnits], "test", "test")
    await tx.wait();
    let basketAddress = await bcContract.getBaskets();
    basketAddress = basketAddress[0]
    console.log("BasketToken generated at:", basketAddress);
    
    const BasketBroker = await ethers.getContractFactory("BasketBroker");
    const bb = await BasketBroker.deploy(basketAddress, "0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9", 
                                         "0xa36085F69e2889c224210F603D836748e7dC0088", "0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4")
    console.log("Basket deployed at", bb.address)
    
  
    const erc1 = new ethers.Contract(e1.address, ERC20.abi, owner);
    const approve1 = await erc1.connect(owner).approve(bb.address, allowance);
    approve1.wait()
    
    const erc2 = new ethers.Contract(e2.address, ERC20.abi, owner);
    const approve2 = await erc2.connect(owner).approve(bb.address, allowance);
    approve2.wait()
     
    await bb.mintBasketToken(basketAddress, ethers.utils.parseEther("10"), owner.address);
    
    const basketToken = new ethers.Contract(basketAddress, BASKETTOKEN.abi, owner)
    const basketHoldings = await basketToken.balanceOf(owner.address);
    // basketHoldings = basketHoldings.toString()
    expect(basketHoldings.toString()).to.equal("10000000000000000000");
    
    const erc1holdings = await erc1.balanceOf(owner.address);
    expect(erc1holdings.toString()).to.equal("90000000000000000000");
    
    const erc2holdings = await erc2.balanceOf(owner.address);
    expect(erc2holdings.toString()).to.equal("90000000000000000000");
    
    const bApprove = await basketToken.connect(owner).approve(bb.address, ethers.utils.parseEther("10"));
    bApprove.wait()
  
    await bb.redeemFundsFromBasket(basketAddress, ethers.utils.parseEther("10"), owner.address);
  
    const newBasketHoldings = await basketToken.balanceOf(owner.address);
    expect(newBasketHoldings.toString()).to.equal("0");
    
    const newErc1holdings = await erc1.balanceOf(owner.address);
    expect(newErc1holdings.toString()).to.equal("100000000000000000000");
    
    const newErc2holdings = await erc2.balanceOf(owner.address);
    expect(newErc2holdings.toString()).to.equal("100000000000000000000");
  
    const basketContractHoldings = await basketToken.balanceOf(bb.address);
    expect(basketContractHoldings.toString()).to.equal("500000000000000000");

})});