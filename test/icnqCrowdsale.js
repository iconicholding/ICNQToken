const ICNQToken = artifacts.require('./ICNQToken.sol');
const ICNQCrowdsale = artifacts.require('./ICNQCrowdsale.sol');
const TeamAndAdvisorsAllocation = artifacts.require(
  './TeamAndAdvisorsAllocation.sol'
);

import { should, getBlockNow, ensuresException } from './helpers/utils';
import { timer } from './helpers/timer';
const BigNumber = web3.BigNumber;

contract(
  'ICNQCrowdsale',
  ([owner, wallet, founder1, founder2, buyer, buyer2]) => {
    const rate = new BigNumber(50);
    const goal = new BigNumber(100);
    const cap = new BigNumber(1000000000e18);

    const value = new BigNumber(1e18);

    const expectedCompanyTokens = new BigNumber(2000000e18); // 2M
    const expectedTeamAndAdvisorTokens = new BigNumber(4000000e18); // 4M
    const expectedBountyCampaignTokens = new BigNumber(2000000e18); // 2M

    const dayInSecs = 86400;

    let startTime,
      presaleEndTime,
      firstBonusEndTime,
      secondBonusEndTime,
      endTime;
    let crowdsale, token;
    let teamAndAdvisorsAllocationsContract;

    const newCrowdsale = rate => {
      startTime = getBlockNow() + 20; // crowdsale starts in 2 seconds
      presaleEndTime = startTime + dayInSecs * 20; // 20 days
      firstBonusEndTime = startTime + dayInSecs * 30; // 30 days
      secondBonusEndTime = startTime + dayInSecs * 40; // 40 days
      endTime = startTime + dayInSecs * 60; // 60 days

      return ICNQCrowdsale.new(
        startTime,
        presaleEndTime,
        firstBonusEndTime,
        secondBonusEndTime,
        endTime,
        rate,
        wallet
      );
    };

    beforeEach('initialize contract', async () => {
      crowdsale = await newCrowdsale(rate);
      token = ICNQToken.at(await crowdsale.token());
    });

    it('has a normal crowdsale rate', async () => {
      const crowdsaleRate = await crowdsale.rate();
      crowdsaleRate.should.be.bignumber.equal(rate);
    });

    it('starts with token paused', async () => {
      const paused = await token.paused();
      paused.should.be.true;
    });

    it('finishes minting when crowdsale is finalized', async function() {
      timer(endTime + 30);

      let finishMinting = await token.mintingFinished();
      finishMinting.should.be.false;

      await crowdsale.finalize();

      finishMinting = await token.mintingFinished();
      finishMinting.should.be.true;
    });

    describe('#mintTokenForPrivateInvestors', function() {
      it('mints tokens for private investors after crowdsale has started', async () => {
        timer(50);

        await crowdsale.mintTokenForPrivateInvestors(buyer, rate, 0, value);

        const buyerBalance = await token.balanceOf(buyer);
        buyerBalance.should.be.bignumber.equal(50e18);
      });

      it('mints tokens to private investors before the crowdsale starts', async () => {
        const { logs } = await crowdsale.mintTokenForPrivateInvestors(
          buyer,
          rate,
          0,
          value
        );

        const buyerBalance = await token.balanceOf(buyer);
        buyerBalance.should.be.bignumber.equal(50e18);

        const event = logs.find(
          e => e.event === 'PrivateInvestorTokenPurchase'
        );
        should.exist(event);
      });
    });

    describe('change rate', () => {
      it('does NOT allows anyone to change rate other than the owner', async () => {
        const newRate = new BigNumber(60);

        try {
          await crowdsale.setRate(newRate, { from: buyer });
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        const rate = await crowdsale.rate();
        rate.should.be.bignumber.equal(rate);
      });

      it('cannot set a rate that is zero', async () => {
        const zeroRate = new BigNumber(0);

        try {
          await crowdsale.setRate(zeroRate, { from: owner });
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        const rate = await crowdsale.rate();
        rate.should.be.bignumber.equal(rate);
      });

      it('allows owner to change rate', async () => {
        const newRate = new BigNumber(60);
        await crowdsale.setRate(newRate, { from: owner });

        const rate = await crowdsale.rate();
        rate.should.be.bignumber.equal(newRate);
      });
    });

    describe('token purchases plus their bonuses', () => {
      it('does NOT buy tokens if crowdsale is paused', async () => {
        await timer(dayInSecs * 42);
        await crowdsale.pause();
        let buyerBalance;

        try {
          await crowdsale.buyTokens(buyer, { value });
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        buyerBalance = await token.balanceOf(buyer);
        buyerBalance.should.be.bignumber.equal(0);

        await crowdsale.unpause();
        await crowdsale.buyTokens(buyer, { value });

        buyerBalance = await token.balanceOf(buyer);
        buyerBalance.should.be.bignumber.equal(50e18);
      });

      it('has bonus of 20% during the presale', async () => {
        await timer(50); // within presale period
        await crowdsale.buyTokens(buyer2, { value });

        const buyerBalance = await token.balanceOf(buyer2);
        buyerBalance.should.be.bignumber.equal(75e18); // 50% bonus
      });

      it('stops presale once the presaleCap is reached', async () => {
        const newRate = new BigNumber(700000);
        crowdsale = await newCrowdsale(newRate);
        token = ICNQToken.at(await crowdsale.token());
        await timer(50); // within presale period

        await crowdsale.buyTokens(buyer2, { value });

        try {
          await crowdsale.buyTokens(buyer, { value });
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        const buyerBalance = await token.balanceOf(buyer);
        buyerBalance.should.be.bignumber.equal(0);
      });

      it('is also able to buy tokens with bonus by sending ether to the contract directly', async () => {
        await timer(50);
        await crowdsale.sendTransaction({ from: buyer, value });

        const purchaserBalance = await token.balanceOf(buyer);
        purchaserBalance.should.be.bignumber.equal(75e18); // 50% bonus
      });

      it('gives out 10% bonus during first crowdsale bonus period', async () => {
        await timer(dayInSecs * 22);
        await crowdsale.buyTokens(buyer2, { value });

        const buyerBalance = await token.balanceOf(buyer2);
        buyerBalance.should.be.bignumber.equal(55e18); // 10% bonus
      });

      it('provides 5% bonus during second crowdsale bonus period', async () => {
        timer(dayInSecs * 32);
        await crowdsale.buyTokens(buyer2, { value });

        const buyerBalance = await token.balanceOf(buyer2);
        buyerBalance.should.be.bignumber.equal(575e17); // 5% bonus
      });

      it('provides 0% bonus after second crowdsale bonus period', async () => {
        timer(dayInSecs * 42);
        await crowdsale.buyTokens(buyer2, { value });

        const buyerBalance = await token.balanceOf(buyer2);
        buyerBalance.should.be.bignumber.equal(50e18); // 0% bonus
      });
    });

    describe('finalize crowdsale', () => {
      it('does not allow trading of tokens before the crowdsale finalizes', async () => {
        timer(dayInSecs * 42);
        await crowdsale.buyTokens(buyer, { value: 1e18, from: buyer });
        const buyerBalance = await token.balanceOf(buyer);

        try {
          await token.transfer(buyer2, 10, { from: buyer });
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }
        const buyerBalanceAfterAttemptedTransfer = await token.balanceOf(buyer);
        buyerBalanceAfterAttemptedTransfer.should.be.bignumber.equal(
          buyerBalance
        );
      });

      it('allows token tranfers after crowdsale finalization', async () => {
        timer(dayInSecs * 42);
        await crowdsale.buyTokens(buyer, { value: 2e18, from: buyer });
        timer(dayInSecs * 20);
        const buyerBalance = await token.balanceOf(buyer);

        await crowdsale.finalize();

        await token.transfer(buyer2, 10, { from: buyer });

        const buyerBalanceAfterTransfer = await token.balanceOf(buyer);

        buyerBalanceAfterTransfer.should.be.bignumber.below(buyerBalance);
      });

      it('mints tokens for company, bounty campaign as well as team and advisors', async () => {
        timer(dayInSecs * 62);
        await crowdsale.finalize();

        const teamAndAdvisorsAllocations = await crowdsale.teamAndAdvisorsAllocation();
        teamAndAdvisorsAllocationsContract = TeamAndAdvisorsAllocation.at(
          teamAndAdvisorsAllocations
        );

        const balanceCompany = await token.balanceOf(wallet);
        balanceCompany.should.be.bignumber.equal(
          expectedCompanyTokens.add(expectedBountyCampaignTokens)
        );

        const balanceTeamAndAdvisors = await token.balanceOf(
          await teamAndAdvisorsAllocationsContract.address
        );
        balanceTeamAndAdvisors.should.be.bignumber.equal(
          expectedTeamAndAdvisorTokens
        );
      });
    });

    describe('teamAndAdvisorsAllocations', () => {
      beforeEach(
        'finalizes crowdsale and assigns tokens to company, team & advisors and bounty campaign',
        async () => {
          crowdsale = await newCrowdsale(rate);
          token = ICNQToken.at(await crowdsale.token());

          timer(dayInSecs * 62);

          await crowdsale.finalize();

          const teamAndAdvisorsAllocations = await crowdsale.teamAndAdvisorsAllocation();
          teamAndAdvisorsAllocationsContract = TeamAndAdvisorsAllocation.at(
            teamAndAdvisorsAllocations
          );
        }
      );

      it('assigns tokens correctly to company. It has company tokens + bounty campaign tokens', async function() {
        const balanceCompany = await token.balanceOf(wallet);
        balanceCompany.should.be.bignumber.equal(
          expectedCompanyTokens.add(expectedBountyCampaignTokens)
        );
      });

      it('assigns tokens correctly teamAndAdvisorsAllocations contract', async function() {
        const balanceTeamAndAdvisors = await token.balanceOf(
          await teamAndAdvisorsAllocationsContract.address
        );
        balanceTeamAndAdvisors.should.be.bignumber.equal(
          expectedTeamAndAdvisorTokens
        );
      });

      it('allows to change contract owner', async function() {
        let contractOwner;
        contractOwner = await teamAndAdvisorsAllocationsContract.owner();
        contractOwner.should.be.equal(owner);

        await teamAndAdvisorsAllocationsContract.changeOwner(founder1);

        contractOwner = await teamAndAdvisorsAllocationsContract.owner();
        contractOwner.should.be.equal(founder1);
      });

      it('adds advisors and their allocation', async function() {
        await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation(
          founder1,
          800
        );
        await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation.sendTransaction(
          founder2,
          1000,
          {
            from: owner
          }
        );

        const allocationsForFounder1 = await teamAndAdvisorsAllocationsContract.teamAndAdvisorsAllocations.call(
          founder1
        );
        const allocationsForFounder2 = await teamAndAdvisorsAllocationsContract.teamAndAdvisorsAllocations.call(
          founder2
        );
        allocationsForFounder1.should.be.bignumber.equal(800);
        allocationsForFounder2.should.be.bignumber.equal(1000);
      });

      it('does NOT unlock advisors allocation before the unlock period is up', async function() {
        await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation(
          founder1,
          800
        );
        await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation.sendTransaction(
          founder2,
          1000,
          {
            from: owner
          }
        );

        try {
          await teamAndAdvisorsAllocationsContract.unlock({ from: founder1 });
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        const tokensCreated = await teamAndAdvisorsAllocationsContract.tokensTransferred();
        tokensCreated.should.be.bignumber.equal(0);
      });

      it('unlocks advisors allocation after the unlock period is up', async function() {
        let tokensCreated;
        await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation(
          founder1,
          800
        );
        await teamAndAdvisorsAllocationsContract.addTeamAndAdvisorsAllocation.sendTransaction(
          founder2,
          1000,
          {
            from: owner
          }
        );

        tokensCreated = await teamAndAdvisorsAllocationsContract.tokensTransferred();
        tokensCreated.should.be.bignumber.equal(0);

        await timer(dayInSecs * 390);

        await teamAndAdvisorsAllocationsContract.unlock({ from: founder1 });
        await teamAndAdvisorsAllocationsContract.unlock({ from: founder2 });

        const tokenBalanceFounder1 = await token.balanceOf(founder1);
        const tokenBalanceFounder2 = await token.balanceOf(founder2);
        tokenBalanceFounder1.should.be.bignumber.equal(800);
        tokenBalanceFounder2.should.be.bignumber.equal(1000);
      });

      // it('does NOT unlock founders allocation before the unlock period is up', async function() {
      //   try {
      //     await teamAndAdvisorsAllocationsContract.unlock({
      //       from: owner
      //     });
      //     assert.fail();
      //   } catch (e) {
      //     ensuresException(e);
      //   }
      //
      //   const tokensTransferred = await teamAndAdvisorsAllocationsContract.tokensTransferred();
      //   tokensTransferred.should.be.bignumber.equal(0);
      // });

      // it('does NOT allow other person rather than owner to unlock token allocation', async function() {
      //   await timer(dayInSecs * 365);
      //
      //   try {
      //     await teamAndAdvisorsAllocationsContract.unlock({
      //       from: founder1
      //     });
      //     assert.fail();
      //   } catch (e) {
      //     ensuresException(e);
      //   }
      //
      //   const tokensTransferred = await teamAndAdvisorsAllocationsContract.tokensTransferred();
      //   tokensTransferred.should.be.bignumber.equal(0);
      // });

      //   it('unlocks all tokens after unlock period is up', async function() {
      //     let tokensTransferred;
      //     let companyWalletBalance;
      //
      //     tokensTransferred = await teamAndAdvisorsAllocationsContract.tokensTransferred();
      //     tokensTransferred.should.be.bignumber.equal(0);
      //
      //     companyWalletBalance = await token.balanceOf(wallet);
      //     companyWalletBalance.should.be.bignumber.equal(
      //       expectedCompanyTokens.add(expectedBountyCampaignTokens)
      //     );
      //
      //     await timer(dayInSecs * 366);
      //
      //     await teamAndAdvisorsAllocationsContract.unlock({
      //       from: owner
      //     });
      //
      //     companyWalletBalance = await token.balanceOf(wallet);
      //     // bounty tokens + company tokens + team and advisors
      //     companyWalletBalance.should.be.bignumber.equal(
      //       expectedCompanyTokens
      //         .add(expectedBountyCampaignTokens)
      //         .add(expectedTeamAndAdvisorTokens)
      //     );
      //
      //     tokensTransferred = await teamAndAdvisorsAllocationsContract.tokensTransferred();
      //     tokensTransferred.should.be.bignumber.equal(
      //       expectedTeamAndAdvisorTokens
      //     );
      //   });
    });
  }
);
