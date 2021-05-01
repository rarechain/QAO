import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { QaoToken } from "../typechain";
import { BigNumber, providers } from "ethers";

chai.use(solidity);
const { expect } = chai;


describe("QaoToken Basics", () => {

    const dayInSeconds: number = 86400;
    let token: QaoToken;
    let accounts: any;

    let owner: any;
    let swapLiqPool: any;
    let treasuryGuard: any;
    let airdropPool: any;
    let liqPool: any;
    let apiRewardPool: any;

    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];
        airdropPool = accounts[14];
        liqPool = accounts[15];
        apiRewardPool = accounts[16];
        swapLiqPool = accounts[18];
        treasuryGuard = accounts[19];

        const tokenFactory = await ethers.getContractFactory("QAOToken", owner);
        token = (await tokenFactory.deploy(swapLiqPool.address, treasuryGuard.address)) as QaoToken;
        await token.deployed();

        expect(await token.name()).to.eq("QAO");
        expect(await token.owner()).to.eq(owner.address);
        expect(await token.decimals()).to.eq(18);
        expect(await token.totalSupply()).to.eq(ethers.utils.parseEther("10000000000000"));
    });


    describe("Basics", async () => {

        it("genesis supply", async () => {
            expect(await token.balanceOf(swapLiqPool.address)).to.eq(ethers.utils.parseEther("9000000000000"));
            expect(await token.balanceOf(token.address)).to.eq(ethers.utils.parseEther("1000000000000"));
        });

        it("burning", async () => {
            const totalSupplyBefore: BigNumber = await token.totalSupply();
            const balanceBurnerBefore: BigNumber = await token.balanceOf(swapLiqPool.address);
            const balanceAddr0Before: BigNumber = await token.balanceOf(ethers.constants.AddressZero);

            token.connect(swapLiqPool).burn(ethers.utils.parseEther("4500000000000"));

            const totalSupplyAfter: BigNumber = await token.totalSupply();
            const balanceBurnerAfter: BigNumber = await token.balanceOf(swapLiqPool.address);
            const balanceAddr0After: BigNumber = await token.balanceOf(ethers.constants.AddressZero);

            expect(totalSupplyAfter).to.eq(totalSupplyBefore);
            expect(balanceBurnerAfter).to.eq(balanceBurnerBefore.sub(ethers.utils.parseEther("4500000000000")));
            expect(balanceAddr0After).to.eq(balanceAddr0Before.add(ethers.utils.parseEther("4500000000000")));
        });

       
    });

    describe("Minting", async () => {

        it("activate minting", async () => {
            const totalSupplyBefore: BigNumber = await token.totalSupply();
            const airdropPoolBalanceBefore: BigNumber = await token.balanceOf(airdropPool.address);
            const liqPoolBalanceBefore: BigNumber = await token.balanceOf(liqPool.address);
            const apiRewardPoolBalanceBefore: BigNumber = await token.balanceOf(apiRewardPool.address);

            await token.connect(owner).setAirdropPool(airdropPool.address);
            await token.connect(owner).setLiquidityPool(liqPool.address);
            await token.connect(owner).setApiRewardPool(apiRewardPool.address);

            await token.connect(owner).activateMinting();

            const totalSupplyAfter: BigNumber = await token.totalSupply();
            const airdropPoolBalanceAfter: BigNumber = await token.balanceOf(airdropPool.address);
            const liqPoolBalanceAfter: BigNumber = await token.balanceOf(liqPool.address);
            const apiRewardPoolBalanceAfter: BigNumber = await token.balanceOf(apiRewardPool.address);

            expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(ethers.utils.parseEther("100000000")));
            expect(airdropPoolBalanceAfter).to.eq(airdropPoolBalanceBefore.add(ethers.utils.parseEther("45000000")));
            expect(liqPoolBalanceAfter).to.eq(liqPoolBalanceBefore.add(ethers.utils.parseEther("45000000")));
            expect(apiRewardPoolBalanceAfter).to.eq(apiRewardPoolBalanceBefore.add(ethers.utils.parseEther("10000000")));
        });

        it("daily minting", async () => {
            const totalSupplyBefore: BigNumber = await token.totalSupply();
            const airdropPoolBalanceBefore: BigNumber = await token.balanceOf(airdropPool.address);
            const liqPoolBalanceBefore: BigNumber = await token.balanceOf(liqPool.address);
            const apiRewardPoolBalanceBefore: BigNumber = await token.balanceOf(apiRewardPool.address);

            // no minting on same day 
            await token.connect(owner).transfer(accounts[1].address, 0);

            let totalSupplyAfter: BigNumber = await token.totalSupply();
            let airdropPoolBalanceAfter: BigNumber = await token.balanceOf(airdropPool.address);
            let liqPoolBalanceAfter: BigNumber = await token.balanceOf(liqPool.address);
            let apiRewardPoolBalanceAfter: BigNumber = await token.balanceOf(apiRewardPool.address);

            expect(totalSupplyAfter).to.eq(totalSupplyBefore);
            expect(airdropPoolBalanceAfter).to.eq(airdropPoolBalanceBefore);
            expect(liqPoolBalanceAfter).to.eq(liqPoolBalanceBefore);
            expect(apiRewardPoolBalanceAfter).to.eq(apiRewardPoolBalanceBefore);

            // automatic minting after 1 day
            await ethers.provider.send("evm_increaseTime",[dayInSeconds]);
            await ethers.provider.send("evm_mine", []);
            await token.connect(owner).transfer(accounts[1].address, 0);

            totalSupplyAfter = await token.totalSupply();
            airdropPoolBalanceAfter = await token.balanceOf(airdropPool.address);
            liqPoolBalanceAfter = await token.balanceOf(liqPool.address);
            apiRewardPoolBalanceAfter = await token.balanceOf(apiRewardPool.address);

            expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(ethers.utils.parseEther("100000000")));
            expect(airdropPoolBalanceAfter).to.eq(airdropPoolBalanceBefore.add(ethers.utils.parseEther("45000000")));
            expect(liqPoolBalanceAfter).to.eq(liqPoolBalanceBefore.add(ethers.utils.parseEther("45000000")));
            expect(apiRewardPoolBalanceAfter).to.eq(apiRewardPoolBalanceBefore.add(ethers.utils.parseEther("10000000")));

            // no minting on same day again
             await token.connect(owner).transfer(accounts[1].address, 0);

             totalSupplyAfter = await token.totalSupply();
             airdropPoolBalanceAfter = await token.balanceOf(airdropPool.address);
             liqPoolBalanceAfter = await token.balanceOf(liqPool.address);
             apiRewardPoolBalanceAfter = await token.balanceOf(apiRewardPool.address);

             expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(ethers.utils.parseEther("100000000")));
             expect(airdropPoolBalanceAfter).to.eq(airdropPoolBalanceBefore.add(ethers.utils.parseEther("45000000")));
             expect(liqPoolBalanceAfter).to.eq(liqPoolBalanceBefore.add(ethers.utils.parseEther("45000000")));
             expect(apiRewardPoolBalanceAfter).to.eq(apiRewardPoolBalanceBefore.add(ethers.utils.parseEther("10000000")));
        });

        it("remint missed days", async () => {
            const totalSupplyBefore: BigNumber = await token.totalSupply();
            const airdropPoolBalanceBefore: BigNumber = await token.balanceOf(airdropPool.address);
            const liqPoolBalanceBefore: BigNumber = await token.balanceOf(liqPool.address);
            const apiRewardPoolBalanceBefore: BigNumber = await token.balanceOf(apiRewardPool.address);

            // automatic minting after 1 day
            await ethers.provider.send("evm_increaseTime",[dayInSeconds*3]);
            await ethers.provider.send("evm_mine", []);
            await token.connect(owner).transfer(accounts[1].address, 0);

            let totalSupplyAfter: BigNumber = await token.totalSupply();
            let airdropPoolBalanceAfter: BigNumber = await token.balanceOf(airdropPool.address);
            let liqPoolBalanceAfter: BigNumber = await token.balanceOf(liqPool.address);
            let apiRewardPoolBalanceAfter: BigNumber = await token.balanceOf(apiRewardPool.address);

             expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(ethers.utils.parseEther("100000000").mul(3)));
             expect(airdropPoolBalanceAfter).to.eq(airdropPoolBalanceBefore.add(ethers.utils.parseEther("45000000").mul(3)));
             expect(liqPoolBalanceAfter).to.eq(liqPoolBalanceBefore.add(ethers.utils.parseEther("45000000").mul(3)));
             expect(apiRewardPoolBalanceAfter).to.eq(apiRewardPoolBalanceBefore.add(ethers.utils.parseEther("10000000").mul(3)));
        });

        it("change of mint multiplier", async () => {
            const totalSupplyBefore: BigNumber = await token.totalSupply();
            const airdropPoolBalanceBefore: BigNumber = await token.balanceOf(airdropPool.address);
            const liqPoolBalanceBefore: BigNumber = await token.balanceOf(liqPool.address);
            const apiRewardPoolBalanceBefore: BigNumber = await token.balanceOf(apiRewardPool.address);

            // set mint multiplier to 0.5
            await token.connect(owner).setMintMultiplier(ethers.utils.parseEther("0.5"));

            // automatic minting after 1 day
            await ethers.provider.send("evm_increaseTime",[dayInSeconds]);
            await ethers.provider.send("evm_mine", []);
            await token.connect(owner).transfer(accounts[1].address, 0);

            let totalSupplyAfter: BigNumber = await token.totalSupply();
            let airdropPoolBalanceAfter: BigNumber = await token.balanceOf(airdropPool.address);
            let liqPoolBalanceAfter: BigNumber = await token.balanceOf(liqPool.address);
            let apiRewardPoolBalanceAfter: BigNumber = await token.balanceOf(apiRewardPool.address);


            expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(ethers.utils.parseEther("50000000")));
            expect(airdropPoolBalanceAfter).to.eq(airdropPoolBalanceBefore.add(ethers.utils.parseEther("22500000")));
            expect(liqPoolBalanceAfter).to.eq(liqPoolBalanceBefore.add(ethers.utils.parseEther("22500000")));
            expect(apiRewardPoolBalanceAfter).to.eq(apiRewardPoolBalanceBefore.add(ethers.utils.parseEther("5000000")));
        });


        it("change of distribution shares", async () => {

            const totalSupplyBefore: BigNumber = await token.totalSupply();
            const airdropPoolBalanceBefore: BigNumber = await token.balanceOf(airdropPool.address);
            const liqPoolBalanceBefore: BigNumber = await token.balanceOf(liqPool.address);
            const apiRewardPoolBalanceBefore: BigNumber = await token.balanceOf(apiRewardPool.address);

            await token.connect(owner).setMintApiRewardShare(0);
            await token.connect(owner).setMintAirdropShare(ethers.utils.parseEther("0.5"));
            await token.connect(owner).setMintLiqPoolShare(ethers.utils.parseEther("0.5"));

            // automatic minting after 1 day
            await ethers.provider.send("evm_increaseTime",[dayInSeconds]);
            await ethers.provider.send("evm_mine", []);
            await token.connect(owner).transfer(accounts[1].address, 0);
            
            let totalSupplyAfter: BigNumber = await token.totalSupply();
            let airdropPoolBalanceAfter: BigNumber = await token.balanceOf(airdropPool.address);
            let liqPoolBalanceAfter: BigNumber = await token.balanceOf(liqPool.address);
            let apiRewardPoolBalanceAfter: BigNumber = await token.balanceOf(apiRewardPool.address);
            
            expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(ethers.utils.parseEther("50000000")));
            expect(airdropPoolBalanceAfter).to.eq(airdropPoolBalanceBefore.add(ethers.utils.parseEther("25000000")));
            expect(liqPoolBalanceAfter).to.eq(liqPoolBalanceBefore.add(ethers.utils.parseEther("25000000")));
            expect(apiRewardPoolBalanceAfter).to.eq(apiRewardPoolBalanceBefore.add("0"));
        });

    });

    describe("Treasury Pool", async () => {

        it("annual minting to treasury", async () => {

            let balanceTreasuryBefore: BigNumber = await token.balanceOf(token.address);
            // treasury should not increase within same year
            await token.connect(owner).transfer(accounts[1].address, 0);
            expect(await token.balanceOf(token.address)).to.eq(balanceTreasuryBefore);

            // increase year and check again
            for (let i: number = 0; i <= 365; i++){
                await ethers.provider.send("evm_increaseTime",[dayInSeconds]);
                await ethers.provider.send("evm_mine", []);
                await token.connect(owner).transfer(accounts[1].address, 0);
            }
            const balanceTreasuryAfter: BigNumber = await token.balanceOf(token.address);
            expect(balanceTreasuryAfter).to.eq(balanceTreasuryBefore.add(ethers.utils.parseEther("1000000000000")));

            // treasury should not increase within same year
            await token.connect(owner).transfer(accounts[1].address, 0);
            expect(await token.balanceOf(token.address)).to.eq(balanceTreasuryAfter);
        });

        it("Locked treasury pool cannot be accessed", async () => {
            await expect(token.connect(owner)
                    .withdrawFromTreasury(owner.address, BigNumber.from(ethers.utils.parseEther("1"))))
                    .to.be.reverted;
        });

        it("Unlocked treasury pool can be accessed", async () => {
            const balanceOwnerBefore: BigNumber = await token.balanceOf(owner.address);
            await token.connect(owner).unlockTreasuryByOwner();
            await token.connect(treasuryGuard).unlockTreasuryByGuard();
            await token.connect(owner).withdrawFromTreasury(owner.address, BigNumber.from(ethers.utils.parseEther("50")));
            const balanceOwnerAfter: BigNumber = await token.balanceOf(owner.address);
            expect(balanceOwnerAfter).to.eq(balanceOwnerBefore.add(ethers.utils.parseEther("50")));

            // lock closes automatically after one withdraw
            await expect(token.connect(owner)
            .withdrawFromTreasury(owner.address, BigNumber.from(ethers.utils.parseEther("1"))))
            .to.be.reverted;

        });
    });

});