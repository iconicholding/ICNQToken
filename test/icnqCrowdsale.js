const ICNQToken = artifacts.require('./ICNQToken.sol')
const ICNQCrowdsale = artifacts.require('./ICNQCrowdsale.sol')
const TeamAndAdvisorsAllocation = artifacts.require("./TeamAndAdvisorsAllocation.sol")

import { should, getBlockNow, ensuresException } from  './helpers/utils'
import { timer } from './helpers/timer'
const BigNumber = web3.BigNumber

contract('ICNQCrowdsale', ([owner, wallet, founder1, founder2, buyer, buyer2]) => {
    const rate = new BigNumber(50)
    const goal = new BigNumber(100)
    const cap = new BigNumber(1000000000e+18)

    const value = new BigNumber(1e+18)

    const expectedCompanyTokens = new BigNumber(1700000e+18); // 1.7M
    const expectedTeamAndAdvisorTokens = new BigNumber(4000000e+18); // 4M
    const expectedBountyCampaignTokens = new BigNumber(1600000e+18); // 1.6M

    const dayInSecs = 86400

    let startTime, presaleEndTime, firstBonusEndTime, secondBonusEndTime, endTime
    let crowdsale, token
    let teamAndAdvisorsAllocationsContract

    const newCrowdsale = (rate) => {
        startTime = getBlockNow() + 20 // crowdsale starts in 2 seconds
        presaleEndTime = startTime + (dayInSecs * 20) // 20 days
        firstBonusEndTime = startTime + (dayInSecs * 30) // 30 days
        secondBonusEndTime = startTime + (dayInSecs * 40) // 40 days
        endTime = startTime + (dayInSecs * 60) // 60 days

        return ICNQCrowdsale.new(
            startTime,
            presaleEndTime,
            firstBonusEndTime,
            secondBonusEndTime,
            endTime,
            rate,
            goal,
            cap,
            wallet
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
        paused.should.be.true
    })

    describe('token purchases plus their bonuses', () => {
        it('does NOT buy tokens if crowdsale is paused', async () => {
            await timer(dayInSecs * 42)
            await crowdsale.pause()
            let buyerBalance

            try {
                await crowdsale.buyTokens(buyer, { value })
                assert.fail()
            } catch(e) {
                ensuresException(e)
            }

            buyerBalance = await token.balanceOf(buyer)
            buyerBalance.should.be.bignumber.equal(0)

            await crowdsale.unpause()
            await crowdsale.buyTokens(buyer, { value })

            buyerBalance = await token.balanceOf(buyer)
            buyerBalance.should.be.bignumber.equal(50e+18)
        })

        it('has bonus of 20% during the presale', async () => {
            await timer(50) // within presale period
            await crowdsale.buyTokens(buyer2, { value })

            const buyerBalance = await token.balanceOf(buyer2)
            buyerBalance.should.be.bignumber.equal(75e+18) // 50% bonus
        })

        it('stops presale once the presaleCap is reached', async () => {
            const newRate = new BigNumber(700000)
            crowdsale = await newCrowdsale(newRate)
            token = ICNQToken.at(await crowdsale.token())
            await timer(50) // within presale period

            await crowdsale.buyTokens(buyer2, { value })

            try {
                await crowdsale.buyTokens(buyer, { value })
                assert.fail()
            } catch (e) {
                ensuresException(e)
            }

            const buyerBalance = await token.balanceOf(buyer)
            buyerBalance.should.be.bignumber.equal(0)
        })

        it('is also able to buy tokens with bonus by sending ether to the contract directly', async () => {
            await timer(50)
            await crowdsale.sendTransaction({ from: buyer, value })

            const purchaserBalance = await token.balanceOf(buyer)
            purchaserBalance.should.be.bignumber.equal(75e+18) // 50% bonus
        })

        it('gives out 10% bonus during first crowdsale bonus period', async () => {
            await timer(dayInSecs * 22)
            await crowdsale.buyTokens(buyer2, { value })

            const buyerBalance = await token.balanceOf(buyer2)
            buyerBalance.should.be.bignumber.equal(55e+18) // 10% bonus
        })

        it('provides 5% bonus during second crowdsale bonus period', async () => {
            timer(dayInSecs * 32)
            await crowdsale.buyTokens(buyer2, { value })

            const buyerBalance = await token.balanceOf(buyer2)
            buyerBalance.should.be.bignumber.equal(575e+17) // 5% bonus
        })

        it('provides 0% bonus after second crowdsale bonus period', async () => {
            timer(dayInSecs * 42)
            await crowdsale.buyTokens(buyer2, { value })

            const buyerBalance = await token.balanceOf(buyer2)
            buyerBalance.should.be.bignumber.equal(50e+18) // 0% bonus
        })
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

        it('assigns tokens correctly to company. It has company tokens + bounty campaign tokens', async function () {
            const balanceCompany = await token.balanceOf(wallet)
            balanceCompany.should.be.bignumber.equal(expectedCompanyTokens.add(expectedBountyCampaignTokens))
        })

        it('assigns tokens correctly teamAndAdvisorsAllocations contract', async function () {
            const balanceTeamAndAdvisors = await token.balanceOf(await teamAndAdvisorsAllocationsContract.address)
            balanceTeamAndAdvisors.should.be.bignumber.equal(expectedTeamAndAdvisorTokens)
        })

        it('allows to change contract owner', async function () {
            let contractOwner
            contractOwner = await teamAndAdvisorsAllocationsContract.owner()
            contractOwner.should.be.equal(owner)

            await teamAndAdvisorsAllocationsContract.changeOwner(founder1)

            contractOwner = await teamAndAdvisorsAllocationsContract.owner()
            contractOwner.should.be.equal(founder1)
        })

        it('does NOT unlock founders allocation before the unlock period is up', async function () {
            try {
             await teamAndAdvisorsAllocationsContract.unlock({from: owner})
             assert.fail()
            } catch(e) {
             ensuresException(e)
            }

            const tokensTransferred = await teamAndAdvisorsAllocationsContract.tokensTransferred()
            tokensTransferred.should.be.bignumber.equal(0)
        })

        it('does NOT allow other person rather than owner to unlock token allocation', async function () {
            await timer(dayInSecs * 365)

            try {
             await teamAndAdvisorsAllocationsContract.unlock({from: founder1})
             assert.fail()
            } catch(e) {
             ensuresException(e)
            }

            const tokensTransferred = await teamAndAdvisorsAllocationsContract.tokensTransferred()
            tokensTransferred.should.be.bignumber.equal(0)
        })

        it('unlocks all tokens after unlock period is up', async function () {
            let tokensTransferred
            let companyWalletBalance

            tokensTransferred = await teamAndAdvisorsAllocationsContract.tokensTransferred()
            tokensTransferred.should.be.bignumber.equal(0)

            companyWalletBalance = await token.balanceOf(wallet)
            companyWalletBalance.should.be.bignumber.equal(expectedCompanyTokens.add(expectedBountyCampaignTokens))

            await timer(dayInSecs * 365)

            await teamAndAdvisorsAllocationsContract.unlock({from: owner})

            companyWalletBalance = await token.balanceOf(wallet)
            // bounty tokens + company tokens + team and advisors
            companyWalletBalance.should.be.bignumber.equal(expectedCompanyTokens.add(expectedBountyCampaignTokens).add(expectedTeamAndAdvisorTokens))

            tokensTransferred = await teamAndAdvisorsAllocationsContract.tokensTransferred()
            tokensTransferred.should.be.bignumber.equal(expectedTeamAndAdvisorTokens)
        })

        it('does NOT kill contract before one year is up', async function () {
            try {
             await teamAndAdvisorsAllocationsContract.kill()
             assert.fail()
            } catch(e) {
             ensuresException(e)
            }

            const balance = await token.balanceOf(await teamAndAdvisorsAllocationsContract.address)
            balance.should.be.bignumber.equal(expectedTeamAndAdvisorTokens)

            const tokensTransferred = await teamAndAdvisorsAllocationsContract.tokensTransferred()
            tokensTransferred.should.be.bignumber.equal(0)
        })

        it('is able to kill contract after one year', async () => {
            const tokensTransferred = await teamAndAdvisorsAllocationsContract.tokensTransferred()
            tokensTransferred.should.be.bignumber.equal(0)

            await timer(dayInSecs * 540) // 540 days after

            await teamAndAdvisorsAllocationsContract.kill()

            const balance = await token.balanceOf(await teamAndAdvisorsAllocationsContract.address)
            balance.should.be.bignumber.equal(0)

            const balanceOwner = await token.balanceOf(owner)
            balanceOwner.should.be.bignumber.equal(expectedTeamAndAdvisorTokens)
        })
    })
 })
