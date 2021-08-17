import { HardhatUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-waffle";
import "hardhat-typechain";

const { mainnetAccount, rinkebyAccount, infuraProjectId, localhostDeployAccount } = require('./secrets.json');

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat", 
    solidity: {
        compilers: [{ version: "0.8.1", 
        settings: {
          optimizer : { enabled: true, runs: 1500}
        } 
      }],
    },
    networks: {
        localhost: {
            url: "http://localhost:8545",
            accounts: [localhostDeployAccount]
        },
        testnet: {
            url: "http://localhost:8545",
            chainId: 31337,
            gasPrice: 20000000000,
        },
        rinkeby: {
            url: "https://rinkeby.infura.io/v3/"+infuraProjectId,
            accounts: [rinkebyAccount]
        },
        mainnet: {
            url: "https://mainnet.infura.io/v3/"+infuraProjectId,
            accounts: [mainnetAccount]
        },
    }
};
        
export default config;