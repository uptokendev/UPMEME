const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with", deployer.address);

  // Deploy token implementation
  const Token = await hre.ethers.getContractFactory("TokenTemplate");
  const tokenImpl = await Token.deploy();
  await tokenImpl.deployed();
  console.log("TokenTemplate impl:", tokenImpl.address);

  // Deploy sale implementation
  const Sale = await hre.ethers.getContractFactory("BondingCurveSale");
  const saleImpl = await Sale.deploy();
  await saleImpl.deployed();
  console.log("BondingCurveSale impl:", saleImpl.address);

  // Deploy factory
  const Factory = await hre.ethers.getContractFactory("Factory");
  const factory = await Factory.deploy(tokenImpl.address, saleImpl.address);
  await factory.deployed();
  console.log("Factory:", factory.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});