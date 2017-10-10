const ICNQToken = artifacts.require('./ICNQToken.sol')
const ICNQCrowdsale = artifacts.require('./ICNQCrowdsale.sol')
const TeamAndAdvisorsAllocation = artifacts.require("./TeamAndAdvisorsAllocation.sol")

import { should, getBlockNow, ensuresException } from  './helpers/utils'
import { timer } from './helpers/timer'
const BigNumber = web3.BigNumber

contract('ICNQCrowdsale', ([owner, wallet, wallet2, founder1, founder2]) => {
    const rate = new BigNumber(50)
    const goal = new BigNumber(100)
    const cap = new BigNumber(1000000000e+18)

    const value = new BigNumber(1e+18)

    const expectedCompanyTokens = new BigNumber(1600000e+18); // 1.6M
    const expectedTeamAndAdvisorTokens = new BigNumber(4033333e+18); // 4,033, 333
    const expectedBountyCampaignTokens = new BigNumber(1600000e+18); // 1.6M


    const dayInSecs = 86400

    let startTime, presaleEndTime, firstBonusEndTime, secondBonusEndTime, endTime
    let crowdsale, token
    let teamAndAdvisorsAllocationsContract

    const newCrowdsale = (rate) => {
        startTime = getBlockNow() + 20 // crowdsale starts in 2 seconds
        presaleEndTime = getBlockNow() + dayInSecs * 20 // 20 days
        firstBonusEndTime = startTime + (86400 * 30) // 30 days
        secondBonusEndTime = startTime + (86400 * 40) // 40 days
        firstBonusEndTime = startTime + (86400 * 30) // 30 days
        secondBonusEndTime = startTime + (86400 * 40) // 40 days
        endTime = getBlockNow() + dayInSecs * 60 // 60 days

        return ICNQCrowdsale.new(
            startTime,
            presaleEndTime,
            firstBonusEndTime,
            secondBonusEndTime,
            endTime,
            rate,
            goal,
            cap,
            wallet,
            wallet2
        )
    }

    beforeEach('initialize contract', async () => {
        crowdsale = await newCrowdsale(rate)
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

    describe('teamAndAdvisorsAllocations', () => {
        beforeEach('finalizes crowdsale and assigns tokens to company, team & advisors and bounty campaign', async () => {
            crowdsale = await newCrowdsale(rate)
            token = ICNQToken.at(await crowdsale.token())

            timer(dayInSecs * 62)

            await crowdsale.finalize()
            await crowdsale.unpauseToken() // unpause token so transfer is permitted

            const teamAndAdvisorsAllocations = await crowdsale.teamAndAdvisorsAllocation()
            teamAndAdvisorsAllocationsContract = TeamAndAdvisorsAllocation.at(teamAndAdvisorsAllocations)
        })

        it('assigns tokens correctly to company', async function () {
            const balanceCompany = await token.balanceOf(await wallet)
            balanceCompany.should.be.bignumber.equal(expectedCompanyTokens)
        })

        it('assigns tokens correctly to bountyCampaignWallet', async function () {
            const balanceBountyCampaign = await token.balanceOf(await crowdsale.bountyCampaignWallet())
            balanceBountyCampaign.should.be.bignumber.equal(expectedBountyCampaignTokens)
        })

        it('assigns tokens correctly teamAndAdvisorsAllocations contract', async function () {
            const balanceTeamAndAdvisors = await token.balanceOf(await teamAndAdvisorsAllocationsContract.address)
            balanceTeamAndAdvisors.should.be.bignumber.equal(expectedTeamAndAdvisorTokens)
        })

        it('adds team and Advisor plus their allocations', async function () {
            await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation(founder1, 800)
            await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation.sendTransaction(founder2, 1000, {from: owner})
            const allocatedTokens = await teamAndAdvisorsAllocationsContract.allocatedTokens()
            allocatedTokens.should.be.bignumber.equal(1800)

            const allocationsForFounder1 = await teamAndAdvisorsAllocationsContract.teamAndAdvisorsAllocations.call(founder1)
            const allocationsForFounder2 = await teamAndAdvisorsAllocationsContract.teamAndAdvisorsAllocations.call(founder2)
            allocationsForFounder1.should.be.bignumber.equal(800)
            allocationsForFounder2.should.be.bignumber.equal(1000)
        })

        it('does NOT unlock founders allocation before the unlock period is up', async function () {
            await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation(founder1, 800)
            await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation.sendTransaction(founder2, 1000, {from: owner})

            try {
             await teamAndAdvisorsAllocationsContract.unlock({from: founder1})
             assert.fail()
            } catch(e) {
             ensuresException(e)
            }

            const tokensCreated = await teamAndAdvisorsAllocationsContract.tokensCreated()
            tokensCreated.should.be.bignumber.equal(0)
        })

        it('unlocks founders allocation after the unlock period is up', async function () {
            let tokensCreated
            await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation(founder1, 800)
            await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation.sendTransaction(founder2, 1000, {from: owner})

            tokensCreated = await teamAndAdvisorsAllocationsContract.tokensCreated()
            tokensCreated.should.be.bignumber.equal(0)

            await timer(dayInSecs * 190)

            await teamAndAdvisorsAllocationsContract.unlock({from: founder1})
            await teamAndAdvisorsAllocationsContract.unlock({from: founder2})

            const tokenBalanceFounder1 = await token.balanceOf(founder1)
            const tokenBalanceFounder2 = await token.balanceOf(founder2)
            tokenBalanceFounder1.should.be.bignumber.equal(800)
            tokenBalanceFounder2.should.be.bignumber.equal(1000)
        })

        it('does NOT kill contract before one year is up', async function () {
            await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation(founder1, 800)
            await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation.sendTransaction(founder2, 1000, {from: owner})

            try {
             await teamAndAdvisorsAllocationsContract.kill()
             assert.fail()
            } catch(e) {
             ensuresException(e)
            }

            const balance = await token.balanceOf(await teamAndAdvisorsAllocationsContract.address)
            balance.should.be.bignumber.equal(expectedTeamAndAdvisorTokens)

            const tokensCreated = await teamAndAdvisorsAllocationsContract.tokensCreated()
            tokensCreated.should.be.bignumber.equal(0)
        })

        it('is able to kill contract after one year', async () => {
            await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation.sendTransaction(founder2, 1000, {from: owner})

            const tokensCreated = await teamAndAdvisorsAllocationsContract.tokensCreated()
            tokensCreated.should.be.bignumber.equal(0)

            await timer(dayInSecs * 400) // 400 days after

            await teamAndAdvisorsAllocationsContract.kill()

            const balance = await token.balanceOf(await teamAndAdvisorsAllocationsContract.address)
            balance.should.be.bignumber.equal(0)

            const balanceOwner = await token.balanceOf(owner)
            balanceOwner.should.be.bignumber.equal(expectedTeamAndAdvisorTokens)
        })
    })
 })
