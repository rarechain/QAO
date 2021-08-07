# Local deployment with Hardhat

## Prerequiste 
* Install Hardhat

## Deployment
```
npm install
npx hardhat node
```

* copy secrets-example.json
* put first private key from hardat node inside localhostDeployAccount variable
* put second public key from hardat node inside swapLiqPoolAddress variable
* add a custom RPC to localhost:8545, chainId= 31337 and currency name ETH
* add account in metamask with second account private key to access the tokens when deployed
* put third public key from hardat node inside treasuryAddress variable
* put fourth public key from hardat node inside rewardPoolAddress variable

```
npx hardhat run --network localhost scripts/deploy.js --show-stack-traces
```
* Put Token Address in secrets.json ins variable qaoTokenAddress

```
npx hardhat run --network localhost scripts/deployVoting.js --show-stack-traces
```

* Take in note Token Address and Voting Engine Address to use in other applications