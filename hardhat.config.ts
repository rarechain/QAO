import { HardhatUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-waffle";
import "hardhat-typechain";

//const { mnemonic } = require('./secrets.json');

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
        testnet: {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
            chainId: 97,
            gasPrice: 20000000000,
            //accounts: {mnemonic: mnemonic}
        }
    }
};
        
export default config;