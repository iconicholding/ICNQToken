const BigNumber = web3.BigNumber

export const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should()

/** Returns last block's timestamp */
export function getBlockNow() {
  return web3.eth.getBlock(web3.eth.blockNumber).timestamp // base timestamp off the blockchain
}

function isException(error) {
  let strError = error.toString()
  return strError.includes('invalid opcode') || strError.includes('invalid JUMP')
}

export function ensuresException(error) {
  assert(isException(error), error.toString())
}
