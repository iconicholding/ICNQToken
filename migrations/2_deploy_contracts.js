const ICNQToken = artifacts.require("./ICNQToken.sol");

module.exports = function(deployer, network, [_, wallet]) {
    // token deployed only for testing purposes. NOTE: dont use it for the mainnet.
    deployer.deploy(ICNQToken);
};
