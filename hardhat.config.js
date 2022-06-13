require("dotenv").config();

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");

const CHAIN_IDS = {
  hardhat: 31337, // chain ID for hardhat testing
};

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.7",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
      {
        version: "0.8.7",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
    ],
  },
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    rinkeby :{
      url : `https://eth-rinkeby.alchemyapi.io/v2/${process.env.QUICK_NODE_KEY}`,
      accounts : [
        process.env.PRIVATE_KEY
      ]
    },
    "mainnet-fork": {
      url: "http://127.0.0.1:8545",
      accounts:
      [
         process.env.TEST_ETH_ACCOUNT_PRIVATE_KEY
    ],

      blockNumber: 12903088, // since pool deployment
      chainId:31337,
    },
    hardhat: {
      chainId: CHAIN_IDS.hardhat,
      forking: {
        // Using Alchemy
        url: `https://eth-mainnet.alchemyapi.io/v2/m8GRUpgcN4LE6WT4zQh-FfazWbJWiWKW`, 
        blockNumber: 12903088 // since pool deployment
      },
    }
  }
};