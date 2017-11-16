require('babel-register')
require('babel-polyfill')
process.env.NODE_ENV = 'test'
process.env.BABEL_ENV = 'test'

module.exports = {
  migrations_directory: "./migrations",
  networks: {
      live: {
        network_id: 1, // Ethereum public network
        host: "localhost",
        port: 8545,
        gas: 4712388 // 100 times more gas than live network.
      },
      testnet: {
        network_id: 3, // Official Ethereum test network (Ropsten)
        host: "localhost",
        port: 8545,
        gas: 4712388
      },
      development: {
        host: 'localhost',
        port: 8545,
        network_id: '*',
        gas: 4712388
      }
  }
};
