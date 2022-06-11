const { fromRpcSig } = require("ethereumjs-util");
const ethSigUtil = require("eth-sig-util");
const BigNumber = require("bignumber.js");

const MAX_UINT256 = new BigNumber("2")
  .pow(new BigNumber("256"))
  .minus(new BigNumber("1"));

const sign = (domain, message, privateKey) => {
  const { name, version, chainId , verifyingContract } = domain;
  const { id, cycle, wallet, amount } = message;

  const EIP712Domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ];

  const Permit = [
    { name: "chainId", type: "uint256" },
    { name: "cycle", type: "uint256" },
    { name: "wallet", type: "address" },
    { name: "amount", type: "uint256" },
  ];

  const data = {
    primaryType: "Permit",
    types: { EIP712Domain, Permit },
    domain: { name, version, chainId, verifyingContract },
    message: { id, cycle, wallet, amount },
  };

  const signature = ethSigUtil.signTypedMessage(privateKey, { data });
  return fromRpcSig(signature);
};

module.exports = {
  sign,
};