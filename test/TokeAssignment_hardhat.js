require("dotenv").config();
const { expect } = require("chai");
const BigNumber = require("bignumber.js");
const hre = require("hardhat");
const { sign } = require("./helpers/signatures")
const ManagerABI = require("./abi/Manager.json")
const IUniswapV2PairABI = require("./abi/IUniSwapV2Pair.json")
let provider ;
function toBN(number) {
  return new BigNumber(number);
}
const {
  TOKE_ETH_UNIV2_PAIR,
  TOKE_ASSET,
  WETH_ASSET,
  TOKEMAK_REWARDS_CONTRACT,
  TOKEMAK_MANAGER_CONTRACT,
  TOKEMAK_UNIV2_LP_TOKEN_POOL,
  UNIV2_ROUTER,
} = require("../scripts/helpers/addresses.js");
const { ethers } = require("hardhat");

let strategy;
let netId = hre.network.name;
let owner, uniLpToken;
let signature = {};
const investmentAmount = toBN("13170000000000000").toString();

/**
 * Testing over mainnet fork since Tokemak's contracts
 * seem to be no available on testnets
 */

beforeEach(async function () {
  [owner, addr1, addr2] = await ethers.getSigners();
  const StrategyInstance = await ethers.getContractFactory("TokemakAssignment");
  // uniLpToken = await ethers.getContractAt("UniswapV2Pair",TOKE_ETH_UNIV2_PAIR[netId]);
  // console.log(await uniLpToken.decimals())
  provider = ethers.getDefaultProvider("https://eth-mainnet.alchemyapi.io/v2/m8GRUpgcN4LE6WT4zQh-FfazWbJWiWKW")

  strategy = await StrategyInstance.deploy();
  await strategy.init(
    TOKEMAK_UNIV2_LP_TOKEN_POOL[netId],
    TOKEMAK_REWARDS_CONTRACT[netId],
    TOKEMAK_MANAGER_CONTRACT[netId],
    UNIV2_ROUTER[netId],
    WETH_ASSET[netId],
    TOKE_ASSET[netId],
    TOKE_ETH_UNIV2_PAIR[netId]
  )
});


/********************** */
//    Deposits  
/********************** */

describe("Test initial deposits & stake", function () {
  it("Should deposit into Strategy", async function () {

    // get UniswapV2 TOKE-ETH pair tokenclea
    const uniLpToken = new ethers.Contract(TOKE_ETH_UNIV2_PAIR[netId], IUniswapV2PairABI,provider.getSigner(owner.address));

    // Approve deposit
    await uniLpToken.approve(strategy.address, investmentAmount);

    // Deposit
    await strategy.functions.deposits(TOKE_ETH_UNIV2_PAIR[netId], investmentAmount);

    // call Autocompound
    await strategy.autoCompound();

    // Test owner's balance after deposit/farming
    const lpBalance = await uniLpToken.balanceOf(owner);
    expect(lpBalance).to.be.above(0);
  });
});


/********************** */
//    Auto Compound  
/********************** */

describe("Test Auto-compound with permit", function () {
  it("Should Auto-compound", async function () {

    /** Signature ** */
    const buffer = Buffer.from(process.env.TEST_ETH_ACCOUNT_PRIVATE_KEY, "hex");
    const manager = new ethers.Contract(TOKEMAK_MANAGER_CONTRACT[netId], ManagerABI, provider);
    const res = await manager.functions.getCurrentCycleIndex();
    console.log("manager: ", res)

    // const rewards = await ethers.Contract(TOKEMAK_REWARDS_CONTRACT[netId],);


    // const verifier = await TokeRewards.rewardsSigner();
    // console.log("verifier: ",await verifier);
    const contractData = {
      name: "Ondo Fi",
      version: '1',
      chainId: 1,
      verifyingContract: "verifier",
    };
    const recipient = {
      chainId: 1,
      cycle: 1,//currentCycle,
      wallet: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D,//strategy.address,
      amount: investmentAmount,
    };

    const { v, r, s } = { v: "v", r: "r", s: "s", }// sign(contractData, recipient, buffer);
    signature = {
      recipient,
      v,
      r,
      s,
    };

    /** Signature End ** */

    const uniLpToken = new ethers.Contract(TOKE_ETH_UNIV2_PAIR[netId], IUniswapV2PairABI,provider);
    await strategy.autoCompound(
      signature.recipient,
      signature.v,
      signature.r,
      signature.s
    );

    const lpBalance = await uniLpToken.balanceOf(owner);
    expect(lpBalance).to.be.above(0);
  });
});


/********************** */
//    WITHDRAWALS  
/********************** */

describe("Test Withdraw", function () {
  it("Should  requestWithdrawal Lp tokens", async function () {
    const lpBalance = await uniLpToken.balanceOf(owner);
    strategy.requestWithdrawal(lpBalance);
  });

  // 7 days epoch for withdrawal amount available
  it("Should  withdraw Lp tokens", async function () {
    const lpBalance = await uniLpToken.balanceOf(owner);
    strategy.withdraw(lpBalance);
  });
});