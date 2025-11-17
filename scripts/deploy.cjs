const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with", deployer.address);

  // Deploy token implementation
  const Token = await hre.ethers.getContractFactory("TokenTemplate");
  const tokenImpl = await Token.deploy();
  await tokenImpl.waitForDeployment();
  console.log("TokenTemplate impl:", await tokenImpl.getAddress());

  // Deploy sale implementation
  const Sale = await hre.ethers.getContractFactory("BondingCurveSale");
  const saleImpl = await Sale.deploy();
  await saleImpl.waitForDeployment();
  console.log("BondingCurveSale impl:", await saleImpl.getAddress());

  // Deploy factory
  const Factory = await hre.ethers.getContractFactory("Factory");
  const factory = await Factory.deploy(await tokenImpl.getAddress(), await saleImpl.getAddress());
  await factory.waitForDeployment();
  console.log("Factory:", await factory.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});