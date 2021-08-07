const { qaoTokenAddress, rewardPoolAddress } = require('../secrets.json');

async function main() {

    const [deployer] = await ethers.getSigners();
  
    console.log(
      "Deploying voting contracts with the account:",
      deployer.address
    );
    
    console.log("Account balance:", (await deployer.getBalance()).toString());
  
    const Token = await ethers.getContractFactory("QAOToken");
    const token = new ethers.Contract(qaoTokenAddress, Token.interface, deployer);

    console.log("Token address:", token.address);

    const VotingEngine = await ethers.getContractFactory("QAOVotingEngine");
    const voteEngine = await VotingEngine.deploy(qaoTokenAddress, rewardPoolAddress);
    await voteEngine.deployed();
    console.log("Voting Engine address:", voteEngine.address);

    await token.connect(deployer).setVotingEngine(voteEngine.address);
  }
  
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.log(error);
      process.exit(1);
    });