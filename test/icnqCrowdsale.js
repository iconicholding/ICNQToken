const ICNQToken = artifacts.require('./ICNQToken.sol')
const ICNQCrowdsale = artifacts.require('./ICNQCrowdsale.sol')

import { should, getBlockNow, ensuresException } from  './helpers/utils'
import { timer } from './helpers/timer'
const BigNumber = web3.BigNumber

contract('ICNQCrowdsale', ([_, wallet]) => {
    const rate = new BigNumber(50)
    const goal = new BigNumber(100)
    const cap = new BigNumber(1000e+18)

    const dayInSecs = 86400

    let startTime, presaleEndTime, endTime
    let crowdsale, token

    beforeEach('initialize contract', async () => {
        startTime = getBlockNow() + 2 // crowdsale starts in 2 seconds
        presaleEndTime = getBlockNow() + dayInSecs * 20 // 20 days
        endTime = getBlockNow() + dayInSecs * 60 // 60 days

        crowdsale = await ICNQCrowdsale.new(
            startTime,
            presaleEndTime,
            endTime,
            rate,
            goal,
            cap,
            wallet,
        )

        token = ICNQToken.at(await crowdsale.token())
    })

    it('has a cap', async () => {
      const crowdsaleCap = await crowdsale.cap()
      crowdsaleCap.should.be.bignumber.equal(cap)
    })

    it('has a normal crowdsale rate', async () => {
      const crowdsaleRate = await crowdsale.rate()
      crowdsaleRate.should.be.bignumber.equal(rate)
    })

    it('starts with token paused', async () => {
    const paused = await token.paused()
    paused.should.equal(true)
    })
 })
