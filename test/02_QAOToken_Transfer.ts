import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { QaoToken } from "../typechain";
import { BigNumber } from "ethers";

chai.use(solidity);
const { expect } = chai;


describe("QaoToken Transfer", () => {

    const dayInSeconds: number = 86400;
    let token: QaoToken;
    let accounts: any;

    let owner: any;
    let swapLiqPool: any;
    let treasuryGuard: any;

    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];
        swapLiqPool = accounts[18];
        treasuryGuard = accounts[19];

        const tokenFactory = await ethers.getContractFactory("QAOToken", owner);
        token = (await tokenFactory.deploy(swapLiqPool.address, treasuryGuard.address)) as QaoToken;
        await token.deployed();

        expect(await token.name()).to.eq("QAO");
        expect(await token.owner()).to.eq(owner.address);
        expect(await token.decimals()).to.eq(18);
        //expect(await token.totalSupply()).to.eq(ethers.utils.parseEther("140000000"));

        token.connect(swapLiqPool).transfer(accounts[1].address, 100);
    });


    describe("direct transfer", async () => {

        it("valid direct transfer", async () => {

            let senderBalance: BigNumber = await token.balanceOf(accounts[1].address);
            let receiverBalance: BigNumber = await token.balanceOf(accounts[2].address);

            let totalSupply: BigNumber = await token.totalSupply();

            let transferAmount: BigNumber = BigNumber.from(10);

            // call with event checks
            await expect(token.connect(accounts[1]).transfer(accounts[2].address, transferAmount))
                .to.emit(token, 'Transfer')
                .withArgs(accounts[1].address, accounts[2].address, transferAmount);

            // balance checks
            expect(await token.balanceOf(accounts[1].address)).to.eq(senderBalance.sub(transferAmount));
            expect(await token.balanceOf(accounts[2].address)).to.eq(receiverBalance.add(transferAmount));

            // total supply check
            expect(await token.totalSupply()).to.eq(totalSupply);
        });

        it("invalid direct transfer (empty balance)", async function(){
            await expect(token.connect(accounts[3]).transfer(accounts[1], 100)).to.be.reverted;
        });

        it("invalid direct transfer (balance too low)", async function(){
            await expect(token.connect(accounts[1]).transfer(accounts[2], 500)).to.be.reverted;
        });

        it("invalid direct transfer (AddressZero cannot be recipient of transfer)", async function(){
            await expect(token.connect(accounts[1]).transfer(ethers.constants.AddressZero, 10)).to.be.reverted;
        });
       
    });

    describe("delegated transfer", async () => {

        it("valid delegated transfer", async () => {

            let senderBalance: BigNumber = await token.balanceOf(accounts[1].address);
            let receiverBalance: BigNumber = await token.balanceOf(accounts[3].address);

            let totalSupply: BigNumber = await token.totalSupply();

            let transferAmount: BigNumber = BigNumber.from(10);

            /* step 1 - approval */
            await expect(token.connect(accounts[1]).approve(accounts[2].address, transferAmount))
            .to.emit(token, 'Approval')
            .withArgs(accounts[1].address, accounts[2].address, transferAmount)

            let allowanceValue: BigNumber = await token.allowance(accounts[1].address, accounts[2].address);
            expect(allowanceValue).to.eq(transferAmount);

            /* step 2 - actual transfer */
            await expect(token.connect(accounts[2]).transferFrom(accounts[1].address, accounts[3].address, transferAmount))
            .to.emit(token, 'Transfer')
            .withArgs(accounts[1].address, accounts[3].address, transferAmount)

            // balance checks
            expect(await token.balanceOf(accounts[1].address)).to.eq(senderBalance.sub(transferAmount));
            expect(await token.balanceOf(accounts[3].address)).to.eq(receiverBalance.add(transferAmount));
            
            // allowance check
            expect(await token.allowance(accounts[1].address, accounts[2].address)).to.eq(0);

            // total supply check
            expect(await token.totalSupply()).to.eq(totalSupply);
        });

        it("invalid deleted transfer (no approval)", async () =>{
            await expect(token.connect(accounts[3]).transferFrom(accounts[1].address, accounts[2].address, 10))
                .to.be.reverted;
        });

        it("invalid deleted transfer (approval too low)", async () => {
            await token.connect(accounts[1]).approve(accounts[2].address, 10);
            await expect(token.connect(accounts[2]).transferFrom(accounts[1].address, accounts[2].address, 20))
                .to.be.reverted;
        });

        it("invalid deleted transfer (balance too low)", async () => {
            await token.connect(accounts[3]).approve(accounts[4].address, 10);
            await expect(token.connect(accounts[4]).transferFrom(accounts[3].address, accounts[5].address, 20))
                .to.be.reverted;
        });

        it("invalid deleted transfer (AddressZero cannot be recipient of transfer)", async () => {
            await token.connect(accounts[1]).approve(accounts[2].address, 10);
            await expect(token.connect(accounts[2]).transferFrom(accounts[1].address, ethers.constants.AddressZero, 10))
                .to.be.reverted;
        });

        it("invalid deleted transfer (AddressZero cannot be recipient of transfer)", async () => {
            await token.connect(accounts[1]).approve(accounts[2].address, 10);
            await expect(token.connect(accounts[2]).transferFrom(accounts[1].address, ethers.constants.AddressZero, 10))
                .to.be.reverted;
        });

    });

    describe("increase/decrease allowance", async () => {

        it("valid allowance increase", async () => {

            await token.connect(accounts[4]).increaseAllowance(accounts[5].address, 50);
            let allowanceValue: BigNumber = await token.allowance(accounts[4].address, accounts[5].address);
            expect(allowanceValue).to.eq(50);

            await token.connect(accounts[4]).increaseAllowance(accounts[5].address, 50);
            allowanceValue = await token.allowance(accounts[4].address, accounts[5].address);
            expect(allowanceValue).to.eq(100);


        });

        it("valid allowance increase", async () => {

            await token.connect(accounts[4]).decreaseAllowance(accounts[5].address, 50);
            let allowanceValue: BigNumber = await token.allowance(accounts[4].address, accounts[5].address);
            expect(allowanceValue).to.eq(50);

            await token.connect(accounts[4]).decreaseAllowance(accounts[5].address, 50);
            allowanceValue = await token.allowance(accounts[4].address, accounts[5].address);
            expect(allowanceValue).to.eq(0);


        });

        it("invalid allowance decrease (below zero)", async () => {
            await expect(token.connect(accounts[4]).decreaseAllowance(accounts[5].address, 1))
                .to.be.reverted;    
        });
    });


});