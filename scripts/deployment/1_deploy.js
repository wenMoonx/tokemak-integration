const hre = require("hardhat");
const {
  TOKE_ETH_UNIV2_PAIR,
  TOKE_ASSET,
  WETH_ASSET,
  TOKEMAK_REWARDS_CONTRACT,
  TOKEMAK_MANAGER_CONTRACT,
  TOKEMAK_UNIV2_LP_TOKEN_POOL,
  UNIV2_ROUTER,
} = require("../helpers/addresses.js");

async function main() {
  const netId = await hre.network.name;

  // Get Artifact
  const Strategy = await hre.ethers.getContractFactory("TokemakAssignment");

  // Deploy Contract
  const strategy = await Strategy.deploy();
  await strategy.init(
    TOKEMAK_UNIV2_LP_TOKEN_POOL[netId],
    TOKEMAK_REWARDS_CONTRACT[netId],
    TOKEMAK_MANAGER_CONTRACT[netId],
    UNIV2_ROUTER[netId],
    WETH_ASSET[netId],
    TOKE_ASSET[netId],
    TOKE_ETH_UNIV2_PAIR[netId]
  );

  console.log("deployed to:", strategy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
