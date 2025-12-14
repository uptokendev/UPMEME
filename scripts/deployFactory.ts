import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${await deployer.getAddress()}`);

  let routerAddress = (process.env.ROUTER_ADDRESS ?? "").trim();
  const deployMock = process.env.DEPLOY_MOCK_ROUTER === "true";

  if (!routerAddress && deployMock) {
    const wrapped = (process.env.MOCK_ROUTER_WRAPPED ?? deployer.address).trim();
    console.log(`Deploying MockRouter with wrapped token ${wrapped}...`);
    const MockRouter = await ethers.getContractFactory("MockRouter");
    const mockRouter = await MockRouter.deploy(deployer.address, wrapped);
    await mockRouter.waitForDeployment();
    routerAddress = await mockRouter.getAddress();
    console.log(`MockRouter deployed at ${routerAddress}`);
  }

  if (!routerAddress) {
    throw new Error(
      "Missing ROUTER_ADDRESS. Provide a Pancake router address or set DEPLOY_MOCK_ROUTER=true for local tests."
    );
  }

  console.log(`Deploying LaunchFactory with router ${routerAddress}...`);
  const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
  const factory = await LaunchFactory.deploy(routerAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`LaunchFactory deployed at ${factoryAddress}`);

  const feeRecipient = (process.env.FEE_RECIPIENT ?? "").trim();
  if (feeRecipient) {
    console.log(`Setting fee recipient to ${feeRecipient}...`);
    const tx = await factory.setFeeRecipient(feeRecipient);
    await tx.wait();
  }

  const protocolFeeBpsRaw = (process.env.PROTOCOL_FEE_BPS ?? "").trim();
  if (protocolFeeBpsRaw) {
    const feeValue = Number(protocolFeeBpsRaw);
    if (!Number.isFinite(feeValue) || feeValue < 0 || feeValue > 1000) {
      throw new Error("PROTOCOL_FEE_BPS must be between 0 and 1000.");
    }
    console.log(`Setting protocol fee to ${feeValue} bps...`);
    const tx = await factory.setProtocolFee(feeValue);
    await tx.wait();
  }

  console.log("Deployment complete. Export these addresses for the frontend:");
  console.log(`FACTORY_ADDRESS=${factoryAddress}`);
  if (deployMock) {
    console.log(`MOCK_ROUTER_ADDRESS=${routerAddress}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
