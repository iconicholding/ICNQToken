const ICNQToken = artifacts.require('./ICNQToken.sol');
const ICNQCrowdsale = artifacts.require('./ICNQCrowdsale.sol');
const Whitelist = artifacts.require('./Whitelist.sol');

const BigNumber = web3.BigNumber;

const startTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 80;
const presaleEndTime = startTime + 86400 * 20; // 20 days
const endTime = startTime + 86400 * 60; // 20 days
const rate = new BigNumber(500);

module.exports = function(deployer, network, [_, wallet]) {
    return deployer
        .then(() => {
            // token deployed only for testing purposes. NOTE: dont use it for the mainnet.
            return deployer.deploy(ICNQToken);
        })
        .then(() => {
            return deployer.deploy(Whitelist);
        })
        .then(() => {
            return deployer.deploy(
                ICNQCrowdsale,
                startTime,
                presaleEndTime,
                endTime,
                Whitelist.address,
                rate,
                wallet
            );
        });
};
