const ICNQToken = artifacts.require('./ICNQToken.sol');
const ICNQCrowdsale = artifacts.require('./ICNQCrowdsale.sol');

const BigNumber = web3.BigNumber;

const startTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 80;
const presaleEndTime = startTime + 86400 * 20; // 20 days
const firstBonusEndTime = startTime + 86400 * 30; // 30 days
const secondBonusEndTime = startTime + 86400 * 40; // 40 days
const endTime = startTime + 86400 * 60; // 20 days
const rate = new BigNumber(500);

module.exports = function(deployer, network, [_, wallet]) {
  if (network == 'rinkeby' || network == 'testnet') {
    deployer.deploy(
      ICNQCrowdsale,
      1510905600,
      1510920000,
      1510930800,
      1510941600,
      1510952400,
      100,
      '0xc87B4F92a73b44445dE5E11b0Ba4652Ff34393d9'
    );
  } else {
    // token deployed only for testing purposes. NOTE: dont use it for the mainnet.
    deployer.deploy(ICNQToken);

    deployer.deploy(
      ICNQCrowdsale,
      startTime,
      presaleEndTime,
      firstBonusEndTime,
      secondBonusEndTime,
      endTime,
      rate,
      wallet
    );
  }
};
