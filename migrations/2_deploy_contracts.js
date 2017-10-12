const ICNQToken = artifacts.require("./ICNQToken.sol");
const ICNQCrowdsale = artifacts.require("./ICNQCrowdsale.sol");

const BigNumber = web3.BigNumber

const startTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 80
const presaleEndTime = startTime + (86400 * 20) // 20 days
const firstBonusEndTime = startTime + (86400 * 30) // 30 days
const secondBonusEndTime = startTime + (86400 * 40) // 40 days
const endTime = startTime + (86400 * 60) // 20 days
const goal = new BigNumber(100)
const rate = new BigNumber(500)
const cap = new BigNumber(1000)

module.exports = function(deployer, network, [_, wallet]) {
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
        goal,
        cap,
        wallet
    );
};
