import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { QaoToken, QaoVotingEngine } from "../typechain";
import { BigNumber, ContractTransaction, ContractReceipt } from "ethers";

import {multiplier} from "./multiplier.json";

chai.use(solidity);
const { expect } = chai;


describe("Qao Vote Engine", () => {

    const ether: string = "0".repeat(18);
    const dayInSeconds: number = 86400;
    let token: QaoToken;
    let voteEngine: QaoVotingEngine;
    let accounts: any;

    let owner: any;
    let swapLiqPool: any;
    let treasuryGuard: any;

    let voteId: BigNumber;

    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];
        swapLiqPool = accounts[18];
        treasuryGuard = accounts[19];

        const tokenFactory = await ethers.getContractFactory("QAOToken", owner);
        token = (await tokenFactory.deploy(swapLiqPool.address, treasuryGuard.address)) as QaoToken;
        await token.deployed();

        const voteEngineFactory = await ethers.getContractFactory("QAOVotingEngine", owner);
        voteEngine = (await voteEngineFactory.deploy(token.address)) as QaoVotingEngine;
        await voteEngine.deployed();

        await token.connect(owner).setVotingEngine(voteEngine.address);
        for (let i: number = 0; i < multiplier.length; i++){
            await voteEngine.connect(owner).setRewardByWeek(i+1, ethers.utils.parseEther(multiplier[i]));
        }

    });


    describe("basic vote", async () => {

        it("vote creation", async() => {

            const voteTitle: string = "President Vote";
            const voteDescription: string = "Homer Simpson for President!";
            await token.connect(swapLiqPool).transfer(accounts[1].address, ethers.utils.parseEther("1000000"));

            await token.connect(accounts[1]).approve(voteEngine.address, ethers.utils.parseEther("1000000"));
            const tx: ContractTransaction = await voteEngine.connect(accounts[1]).createVote(voteTitle, voteDescription);
            const receipt: ContractReceipt = await tx.wait();
            const event = receipt.events?.filter((x) => {return x.event == "StartOfVote"})[0];
            voteId = event?.args?.voteId;

            expect(await token.balanceOf(accounts[1].address)).to.eq(0);
            expect(await token.balanceOf(voteEngine.address)).to.eq(ethers.utils.parseEther("1000000"));

            await expect(voteEngine.connect(accounts[1]).withdrawFromVote(voteId)).to.be.reverted;

            const block = await ethers.provider.getBlock(receipt.blockNumber);

            expect(await voteEngine.voteCreator(voteId)).to.eq(accounts[1].address);
            expect(await voteEngine.voteHeading(voteId)).to.eq(voteTitle);
            expect(await voteEngine.voteDescription(voteId)).to.eq(voteDescription);
            expect(await voteEngine.voteCreationTimestamp(voteId)).to.eq(block.timestamp);
            expect(await voteEngine.voteEndTimestamp(voteId)).to.eq(0);
            expect(await voteEngine.voteIsActive(voteId)).to.be.true;
            expect(await voteEngine.voteResultPositive(voteId)).to.eq(ethers.utils.parseEther("1000000"));
            expect(await voteEngine.voteResultNegative(voteId)).to.eq(0);

        });


        it("creation additional vote", async() => {

            const voteTitle: string = "Gold standard";
            const voteDescription: string = "Bring back gold standard";
            await token.connect(swapLiqPool).transfer(accounts[10].address, ethers.utils.parseEther("1000000"));
            await token.connect(accounts[10]).approve(voteEngine.address, ethers.utils.parseEther("1000000"));
            const tx: ContractTransaction = await voteEngine.connect(accounts[10]).createVote(voteTitle, voteDescription);
            const receipt: ContractReceipt = await tx.wait();
            const event = receipt.events?.filter((x) => {return x.event == "StartOfVote"})[0];
            const voteId2: BigNumber = event?.args?.voteId;
            
            expect(voteId2.gt(voteId));

            const block = await ethers.provider.getBlock(receipt.blockNumber);

            expect(await voteEngine.voteCreator(voteId2)).to.eq(accounts[10].address);
            expect(await voteEngine.voteHeading(voteId2)).to.eq(voteTitle);
            expect(await voteEngine.voteDescription(voteId2)).to.eq(voteDescription);
            expect(await voteEngine.voteCreationTimestamp(voteId2)).to.eq(block.timestamp);
            expect(await voteEngine.voteEndTimestamp(voteId2)).to.eq(0);
            expect(await voteEngine.voteIsActive(voteId2)).to.be.true;
            expect(await voteEngine.voteResultPositive(voteId2)).to.eq(ethers.utils.parseEther("1000000"));
            expect(await voteEngine.voteResultNegative(voteId2)).to.eq(0);

        });



        it("vote with option 0 - (including withdraw)", async () => {

            await token.connect(swapLiqPool).transfer(accounts[2].address, ethers.utils.parseEther("5000000"));
            const attendeeBalanceBefore: BigNumber = await token.balanceOf(accounts[2].address);
            const votePositiveBefore: BigNumber = await voteEngine.voteResultPositive(voteId);
            const voteNegativeBefore: BigNumber = await voteEngine.voteResultNegative(voteId);

            await token.connect(accounts[2]).approve(voteEngine.address, ethers.utils.parseEther("5000000"));
            await voteEngine.connect(accounts[2]).vote(voteId, ethers.utils.parseEther("5000000"), 0, 0, false);
            
            let attendeeBalanceAfter: BigNumber = await token.balanceOf(accounts[2].address);
            let votePositiveAfter: BigNumber = await voteEngine.voteResultPositive(voteId);
            let voteNegativeAfter: BigNumber = await voteEngine.voteResultNegative(voteId);

            expect(attendeeBalanceAfter).to.eq(attendeeBalanceBefore.sub(ethers.utils.parseEther("5000000")));
            expect(votePositiveAfter).to.eq(votePositiveBefore);
            expect(voteNegativeAfter).to.eq(voteNegativeBefore.add(ethers.utils.parseEther("5000000")));

            await voteEngine.connect(accounts[2]).withdrawFromVote(voteId);

            attendeeBalanceAfter = await token.balanceOf(accounts[2].address);
            votePositiveAfter = await voteEngine.voteResultPositive(voteId);
            voteNegativeAfter = await voteEngine.voteResultNegative(voteId);

            expect(attendeeBalanceAfter).to.eq(attendeeBalanceBefore);
            expect(votePositiveAfter).to.eq(votePositiveBefore);
            expect(voteNegativeAfter).to.eq(voteNegativeBefore);
        });

        it("vote with option 2 - (stake for 2 years 104 weeks)", async () => {

            const stakedAmount: BigNumber = ethers.utils.parseEther("10000");
            await token.connect(swapLiqPool).transfer(accounts[5].address, stakedAmount);
            await token.connect(accounts[5]).approve(voteEngine.address, stakedAmount);

            const votePositiveBefore: BigNumber = await voteEngine.voteResultPositive(voteId);
            await voteEngine.connect(accounts[5]).vote(voteId, stakedAmount, 104, 2, true);

            const voteWeight: BigNumber = (stakedAmount.mul(ethers.utils.parseEther("4.33"))).div(ethers.utils.parseEther("1"));
            const votePositiveAfter: BigNumber = await voteEngine.voteResultPositive(voteId);
            expect(votePositiveAfter).to.eq(votePositiveBefore.add(voteWeight));

        });

        it("vote with option 1 - (including withdraw)", async () => {

            const stakedAmount: BigNumber = ethers.utils.parseEther("5000000");
            await token.connect(swapLiqPool).transfer(accounts[3].address, stakedAmount);
            await token.connect(accounts[3]).approve(voteEngine.address, stakedAmount);
            await voteEngine.connect(accounts[3]).vote(voteId, stakedAmount, 0, 1, true);

            // wait for 5 weeks
            await ethers.provider.send("evm_increaseTime",[dayInSeconds*35]);
            await ethers.provider.send("evm_mine", []);

            // voting that closes the whole vote
            await token.connect(swapLiqPool).transfer(accounts[4].address, ethers.utils.parseEther("10000000"));
            await token.connect(accounts[4]).approve(voteEngine.address, ethers.utils.parseEther("10000000"));
            const tx: ContractTransaction = await voteEngine.connect(accounts[4]).vote(voteId, ethers.utils.parseEther("10000000"), 0, 0, true);
            const receipt: ContractReceipt = await tx.wait();
            const event = receipt.events?.filter((x) => {return x.event == "EndOfVote"})[0];

            // check if vote has been closed
            expect(event?.args?.voteId).to.eq(voteId);
            expect(await voteEngine.voteIsActive(voteId)).to.be.false;

            const block = await ethers.provider.getBlock(receipt.blockNumber);
            expect(await voteEngine.voteEndTimestamp(voteId)).to.eq(block.timestamp);

            // no more votes possible
            await token.connect(swapLiqPool).transfer(accounts[4].address, ethers.utils.parseEther("10000000"));
            await token.connect(accounts[4]).approve(voteEngine.address, ethers.utils.parseEther("10000000"));
            await expect(voteEngine.connect(accounts[4]).vote(voteId, ethers.utils.parseEther("10000000"), 0, 0, true))
                .to.be.reverted;
            

            // withdraw from option 1
            const expectedReward: BigNumber = (stakedAmount.mul(ethers.utils.parseEther("1.05"))).div(ethers.utils.parseEther("1"));
            const balanceBeforeWithdraw: BigNumber = await token.balanceOf(accounts[3].address);
            await voteEngine.connect(accounts[3]).withdrawFromVote(voteId);
            const balanceAfterWithdraw: BigNumber = await token.balanceOf(accounts[3].address);
            expect(balanceAfterWithdraw).to.eq(balanceBeforeWithdraw.add(expectedReward));

            // cannot withdraw again
            await expect(voteEngine.connect(accounts[3]).withdrawFromVote(voteId))
                .to.be.reverted;
        });


        it("owner withdraw", async () => {

            const stakedAmount: BigNumber = ethers.utils.parseEther("1000000");
            // owner is receiving twice the reward
            const expectedReward: BigNumber = (stakedAmount.mul(ethers.utils.parseEther("1.10"))).div(ethers.utils.parseEther("1"));
            const balanceBeforeWithdraw: BigNumber = await token.balanceOf(accounts[1].address);
            await voteEngine.connect(accounts[1]).withdrawFromVote(voteId);
            const balanceAfterWithdraw: BigNumber = await token.balanceOf(accounts[1].address);
            expect(balanceAfterWithdraw).to.eq(balanceBeforeWithdraw.add(expectedReward));
         
            // cannot withdraw again
            await expect(voteEngine.connect(accounts[1]).withdrawFromVote(voteId))
                .to.be.reverted;

        });

        it("option 2 withdraw after 2 years", async () => {

            // still not able to withdraw
            await expect(voteEngine.connect(accounts[5]).withdrawFromVote(voteId))
                .to.be.reverted;
            
            // wait for 2 years
            await ethers.provider.send("evm_increaseTime",[dayInSeconds*365*2]);
            await ethers.provider.send("evm_mine", []);

            const stakedAmount: BigNumber = ethers.utils.parseEther("10000");
            const balanceBeforeWithdraw: BigNumber = await token.balanceOf(accounts[5].address);
            const expectedReward: BigNumber = (stakedAmount.mul(ethers.utils.parseEther("4.33"))).div(ethers.utils.parseEther("1"));
            
            await voteEngine.connect(accounts[5]).withdrawFromVote(voteId);
            const balanceAfterWithdraw: BigNumber = await token.balanceOf(accounts[5].address);
            expect(balanceAfterWithdraw).to.eq(balanceBeforeWithdraw.add(expectedReward));

            // cannot withdraw again
            await expect(voteEngine.connect(accounts[5]).withdrawFromVote(voteId))
                .to.be.reverted;
        });

       
    });


});