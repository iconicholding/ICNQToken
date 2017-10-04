const { should } = require('./helpers/utils')
const ICNQToken = artifacts.require('./ICNQToken.sol')

contract('ICNQToken', () => {
  let token

  beforeEach(async () => {
    token = await ICNQToken.deployed()
  })

  it('has a name', async () => {
    const name = await token.name()
    name.should.be.equal("Iconiq Lab Token")
  })

  it('possesses a symbol', async () => {
    const symbol = await token.symbol()
    symbol.should.be.equal("ICNQ")
  })

  it('contains 18 decimals', async () => {
    const decimals = await token.decimals()
    decimals.should.be.bignumber.equal(18)
  })
})
