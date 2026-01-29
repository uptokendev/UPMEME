import { expect } from "chai";
import { ethers } from "hardhat";

// TreasuryRouter is used as a League fee receiver. These tests ensure
// forwarding failures never revert and funds are retained safely.

describe("TreasuryRouter", function () {
  it("receive(): forwarding failure emits ForwardFailed and retains funds", async () => {
    const [admin, sender] = await ethers.getSigners();

    const Reverting = await ethers.getContractFactory("RevertingReceiver");
    const badVault = await Reverting.deploy();
    await badVault.waitForDeployment();

    const Router = await ethers.getContractFactory("TreasuryRouter");
    const router = await Router.deploy(await admin.getAddress(), await badVault.getAddress(), 3600);
    await router.waitForDeployment();

    const amount = ethers.parseEther("0.123");

    await expect(sender.sendTransaction({ to: await router.getAddress(), value: amount }))
      .to.emit(router, "ForwardFailed")
      .withArgs(await badVault.getAddress(), amount);

    expect(await ethers.provider.getBalance(await router.getAddress())).to.eq(amount);
  });

  it("forwardingPaused prevents forwarding attempts", async () => {
    const [admin, sender] = await ethers.getSigners();

    const Reverting = await ethers.getContractFactory("RevertingReceiver");
    const badVault = await Reverting.deploy();
    await badVault.waitForDeployment();

    const Router = await ethers.getContractFactory("TreasuryRouter");
    const router = await Router.deploy(await admin.getAddress(), await badVault.getAddress(), 3600);
    await router.waitForDeployment();

    await (await router.connect(admin).setForwardingPaused(true)).wait();

    const amount = 123n;
    // When paused, receive should not emit ForwardFailed/Forwarded and should simply accept funds.
    await expect(sender.sendTransaction({ to: await router.getAddress(), value: amount }))
      .to.not.emit(router, "ForwardFailed");

    expect(await ethers.provider.getBalance(await router.getAddress())).to.eq(amount);
  });
});
