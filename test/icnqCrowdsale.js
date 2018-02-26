const ICNQToken = artifacts.require('./ICNQToken.sol');
const ICNQCrowdsale = artifacts.require('./ICNQCrowdsale.sol');
const TeamAndAdvisorsAllocation = artifacts.require(
    './TeamAndAdvisorsAllocation.sol'
);
const Whitelist = artifacts.require('./Whitelist.sol');

import { should, getBlockNow, ensuresException } from './helpers/utils';
import must from 'chai';
import { timer } from './helpers/timer';
const BigNumber = web3.BigNumber;

contract(
    'ICNQCrowdsale',
    ([owner, wallet, founder1, founder2, buyer, buyer2]) => {
        const rate = new BigNumber(50);
        let newRate = new BigNumber(60);
        const goal = new BigNumber(100);
        const cap = new BigNumber(1000000000e18);

        const value = new BigNumber(1e18);
        const totalTokensForCrowdsale = new BigNumber(3000000); // 3M

        const expectedCompanyTokens = new BigNumber(2000000e18); // 2M
        const expectedTeamAndAdvisorTokens = new BigNumber(3100000e18); // 3.1M
        const expectedBountyCampaignTokens = new BigNumber(1000000e18); // 1M

        const dayInSecs = 86400;

        let startTime, presaleEndTime, endTime;
        let crowdsale, token, teamAndAdvisorsAllocations, whitelist;

        const newCrowdsale = rate => {
            startTime = getBlockNow() + 20; // crowdsale starts in 2 seconds
            presaleEndTime = startTime + dayInSecs * 20; // 20 days
            endTime = startTime + dayInSecs * 60; // 60 days

            return Whitelist.new().then(whitelistRegistry => {
                whitelist = whitelistRegistry;
                return ICNQCrowdsale.new(
                    startTime,
                    presaleEndTime,
                    endTime,
                    whitelist.address,
                    rate,
                    wallet
                );
            });
        };

        beforeEach('initialize contract', async () => {
            crowdsale = await newCrowdsale(rate);
            token = ICNQToken.at(await crowdsale.token());
            teamAndAdvisorsAllocations = await TeamAndAdvisorsAllocation.new(
                await crowdsale.token(),
                getBlockNow() + dayInSecs * 90
            );
        });

        it('has a normal crowdsale rate', async () => {
            const crowdsaleRate = await crowdsale.rate();
            crowdsaleRate.should.be.bignumber.equal(rate);
        });

        it('has a whitelist contract', async () => {
            const whitelistContract = await crowdsale.whitelist();
            whitelistContract.should.equal(whitelist.address);
        });

        it('starts with token paused', async () => {
            const paused = await token.paused();
            paused.should.be.true;
        });

        it('finishes minting when crowdsale is finalized', async function() {
            timer(endTime + 30);

            await crowdsale.setTeamWalletAddress(
                teamAndAdvisorsAllocations.address
            );

            let finishMinting = await token.mintingFinished();
            finishMinting.should.be.false;

            await crowdsale.finalize();

            finishMinting = await token.mintingFinished();
            finishMinting.should.be.true;
        });

        describe('#mintTokenForPrivateInvestors', function() {
            it('must NOT be called by a non owner', async () => {
                try {
                    await crowdsale.mintTokenForPrivateInvestors(buyer, 10e18, {
                        from: buyer
                    });
                    assert.fail();
                } catch (e) {
                    ensuresException(e);
                }

                const buyerBalance = await token.balanceOf(buyer);
                buyerBalance.should.be.bignumber.equal(0);
            });

            it('should NOT mint tokens when private sale cap is reached', async () => {
                const preCrowdsaleCap = await crowdsale.PRIVATE_SALE_TOTAL();

                try {
                    await crowdsale.mintTokenForPrivateInvestors(
                        buyer,
                        preCrowdsaleCap.toNumber() + 10e18
                    );
                    assert.fail();
                } catch (e) {
                    ensuresException(e);
                }

                const buyerBalance = await token.balanceOf(buyer);
                buyerBalance.should.be.bignumber.equal(0);
            });

            it('should NOT mint tokens for private investors after crowdsale starts', async () => {
                await timer(50);
                try {
                    await crowdsale.mintTokenForPrivateInvestors(buyer, value);
                    assert.fail();
                } catch (e) {
                    ensuresException(e);
                }

                const buyerBalance = await token.balanceOf(buyer);
                buyerBalance.should.be.bignumber.equal(0);
            });

            it('mints tokens to private investors before the crowdsale starts', async () => {
                const { logs } = await crowdsale.mintTokenForPrivateInvestors(
                    buyer,
                    value
                );

                const buyerBalance = await token.balanceOf(buyer);
                buyerBalance.should.be.bignumber.equal(value);

                const event = logs.find(
                    e => e.event === 'PrivateInvestorTokenPurchase'
                );
                should.exist(event);
            });
        });

        describe('changing rate', () => {
            it('does NOT allows anyone to change rate other than the owner', async () => {
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
                const { logs } = await crowdsale.setRate(newRate, {
                    from: owner
                });

                const event = logs.find(e => e.event === 'TokenRateChanged');
                should.exist(event);

                const rate = await crowdsale.rate();
                rate.should.be.bignumber.equal(newRate);
            });
        });

        describe('whitelist', () => {
            it('only allows owner to add to the whitelist', async () => {
                await timer(dayInSecs);

                try {
                    await whitelist.addToWhitelist([buyer, buyer2], {
                        from: buyer
                    });
                    assert.fail();
                } catch (e) {
                    ensuresException(e);
                }

                let isBuyerWhitelisted = await whitelist.isWhitelisted.call(
                    buyer
                );
                isBuyerWhitelisted.should.be.false;

                await whitelist.addToWhitelist([buyer, buyer2], {
                    from: owner
                });

                isBuyerWhitelisted = await whitelist.isWhitelisted.call(buyer);
                isBuyerWhitelisted.should.be.true;
            });

            it('only allows owner to remove from the whitelist', async () => {
                await timer(dayInSecs);
                await whitelist.addToWhitelist([buyer, buyer2], {
                    from: owner
                });

                try {
                    await whitelist.removeFromWhitelist([buyer], {
                        from: buyer2
                    });
                    assert.fail();
                } catch (e) {
                    ensuresException(e);
                }

                let isBuyerWhitelisted = await whitelist.isWhitelisted.call(
                    buyer2
                );
                isBuyerWhitelisted.should.be.true;

                await whitelist.removeFromWhitelist([buyer], { from: owner });

                isBuyerWhitelisted = await whitelist.isWhitelisted.call(buyer);
                isBuyerWhitelisted.should.be.false;
            });

            it('shows whitelist addresses', async () => {
                await timer(dayInSecs);
                await whitelist.addToWhitelist([buyer, buyer2], {
                    from: owner
                });

                const isBuyerWhitelisted = await whitelist.isWhitelisted.call(
                    buyer
                );
                const isBuyer2Whitelisted = await whitelist.isWhitelisted.call(
                    buyer2
                );

                isBuyerWhitelisted.should.be.true;
                isBuyer2Whitelisted.should.be.true;
            });

            it('has WhitelistUpdated event', async () => {
                await timer(dayInSecs);
                const { logs } = await whitelist.addToWhitelist(
                    [buyer, buyer2],
                    {
                        from: owner
                    }
                );

                const event = logs.find(e => e.event === 'WhitelistUpdated');
                must.expect(event).to.exist;
            });
        });

        describe('token purchases plus their bonuses', () => {
            beforeEach(async () => {
                await whitelist.addToWhitelist([buyer, buyer2]);
            });

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

            it('does NOT accept purchase that is less than 1 ether', async () => {
                await timer(dayInSecs * 42);
                let buyerBalance;

                try {
                    await crowdsale.buyTokens(buyer, { value: 1e17 });
                    assert.fail();
                } catch (e) {
                    ensuresException(e);
                }

                buyerBalance = await token.balanceOf(buyer);
                buyerBalance.should.be.bignumber.equal(0);

                await crowdsale.buyTokens(buyer, { value });

                buyerBalance = await token.balanceOf(buyer);
                buyerBalance.should.be.bignumber.equal(50e18);
            });

            it('has bonus of 50% during the presale', async () => {
                await timer(50); // within presale period
                await crowdsale.buyTokens(buyer2, { value });

                const buyerBalance = await token.balanceOf(buyer2);
                buyerBalance.should.be.bignumber.equal(75e18); // 50% bonus
            });

            it('does NOT allow un-whitelisted purchasers to participate in token sale', async () => {
                crowdsale = await newCrowdsale(rate);
                token = ICNQToken.at(await crowdsale.token());
                await timer(dayInSecs * 42);

                try {
                    await crowdsale.buyTokens(buyer, { value });
                    assert.fail();
                } catch (e) {
                    ensuresException(e);
                }
                const buyerBalance = await token.balanceOf(buyer);
                buyerBalance.should.be.bignumber.equal(0);

                await whitelist.addToWhitelist([buyer2]);

                await crowdsale.buyTokens(buyer2, { value });

                const buyer2Balance = await token.balanceOf(buyer2);
                buyer2Balance.should.be.bignumber.equal(50e18);
            });

            it('stops presale once the presaleCap is reached', async () => {
                newRate = new BigNumber(700000);
                crowdsale = await newCrowdsale(newRate);
                token = ICNQToken.at(await crowdsale.token());
                await whitelist.addToWhitelist([buyer, buyer2]);
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

            it('provides 0% bonus after the presale crowdsale bonus period', async () => {
                timer(dayInSecs * 32);
                await crowdsale.buyTokens(buyer2, { value });

                const buyerBalance = await token.balanceOf(buyer2);
                buyerBalance.should.be.bignumber.equal(50e18); // 0% bonus
            });

            it('only mints tokens up to crowdsale cap and when more eth is sent last user purchase info is saved in contract', async () => {
                crowdsale = await newCrowdsale(totalTokensForCrowdsale);
                token = ICNQToken.at(await crowdsale.token());
                await whitelist.addToWhitelist([buyer, buyer2]);
                await timer(dayInSecs);

                await crowdsale.buyTokens(buyer, { from: buyer, value: 2e18 });

                const buyerBalance = await token.balanceOf(buyer);
                buyerBalance.should.be.bignumber.equal(
                    totalTokensForCrowdsale.mul(1e18)
                );

                const remainderPurchaser = await crowdsale.remainderPurchaser();
                remainderPurchaser.should.equal(buyer);

                const remainder = await crowdsale.remainderAmount();
                remainder.toNumber().should.be.equal(1e18);

                try {
                    await crowdsale.buyTokens(buyer, { value, from: buyer });
                    assert.fail();
                } catch (e) {
                    ensuresException(e);
                }
            });
        });

        describe('finalize crowdsale', () => {
            beforeEach(async () => {
                await whitelist.addToWhitelist([buyer, buyer2]);
            });

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
                const buyerBalanceAfterAttemptedTransfer = await token.balanceOf(
                    buyer
                );
                buyerBalanceAfterAttemptedTransfer.should.be.bignumber.equal(
                    buyerBalance
                );
            });

            it('allows token tranfers after crowdsale finalization', async () => {
                timer(dayInSecs * 42);
                await crowdsale.buyTokens(buyer, { value: 2e18, from: buyer });
                timer(dayInSecs * 20);
                const buyerBalance = await token.balanceOf(buyer);

                await crowdsale.setTeamWalletAddress(
                    teamAndAdvisorsAllocations.address
                );

                await crowdsale.finalize();

                await token.transfer(buyer2, 10, { from: buyer });

                const buyerBalanceAfterTransfer = await token.balanceOf(buyer);

                buyerBalanceAfterTransfer.should.be.bignumber.below(
                    buyerBalance
                );
            });

            it('mints tokens for company, bounty campaign as well as team and advisors', async () => {
                timer(dayInSecs * 62);
                await crowdsale.setTeamWalletAddress(
                    teamAndAdvisorsAllocations.address
                );

                await crowdsale.finalize();

                const balanceCompany = await token.balanceOf(wallet);
                balanceCompany.should.be.bignumber.equal(
                    expectedCompanyTokens.add(expectedBountyCampaignTokens)
                );

                const balanceTeamAndAdvisors = await token.balanceOf(
                    await teamAndAdvisorsAllocations.address
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
                    teamAndAdvisorsAllocations = await TeamAndAdvisorsAllocation.new(
                        await crowdsale.token(),
                        getBlockNow() + dayInSecs * 90
                    );
                    timer(dayInSecs * 62);

                    await crowdsale.setTeamWalletAddress(
                        teamAndAdvisorsAllocations.address
                    );

                    await crowdsale.finalize();
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
                    await teamAndAdvisorsAllocations.address
                );
                balanceTeamAndAdvisors.should.be.bignumber.equal(
                    expectedTeamAndAdvisorTokens
                );
            });

            it('allows to change contract owner', async function() {
                let contractOwner;
                contractOwner = await teamAndAdvisorsAllocations.owner();
                contractOwner.should.be.equal(owner);

                await teamAndAdvisorsAllocations.transferOwnership(founder1);

                contractOwner = await teamAndAdvisorsAllocations.owner();
                contractOwner.should.be.equal(founder1);
            });

            it('adds advisors and their allocation', async function() {
                await teamAndAdvisorsAllocations.addTeamAndAdvisorsAllocation(
                    founder1,
                    800
                );
                await teamAndAdvisorsAllocations.addTeamAndAdvisorsAllocation.sendTransaction(
                    founder2,
                    1000,
                    {
                        from: owner
                    }
                );

                const allocationsForFounder1 = await teamAndAdvisorsAllocations.teamAndAdvisorsAllocations.call(
                    founder1
                );
                const allocationsForFounder2 = await teamAndAdvisorsAllocations.teamAndAdvisorsAllocations.call(
                    founder2
                );
                allocationsForFounder1.should.be.bignumber.equal(800);
                allocationsForFounder2.should.be.bignumber.equal(1000);
            });

            it('does NOT unlock advisors allocation before the unlock period is up', async function() {
                await teamAndAdvisorsAllocations.addTeamAndAdvisorsAllocation(
                    founder1,
                    800
                );
                await teamAndAdvisorsAllocations.addTeamAndAdvisorsAllocation.sendTransaction(
                    founder2,
                    1000,
                    {
                        from: owner
                    }
                );

                try {
                    await teamAndAdvisorsAllocations.unlock({
                        from: founder1
                    });
                    assert.fail();
                } catch (e) {
                    ensuresException(e);
                }

                const tokensCreated = await teamAndAdvisorsAllocations.tokensTransferred();
                tokensCreated.should.be.bignumber.equal(0);
            });

            it('unlocks advisors allocation after the unlock period is up', async function() {
                let tokensCreated;
                await teamAndAdvisorsAllocations.addTeamAndAdvisorsAllocation(
                    founder1,
                    800
                );
                await teamAndAdvisorsAllocations.addTeamAndAdvisorsAllocation.sendTransaction(
                    founder2,
                    1000,
                    {
                        from: owner
                    }
                );

                tokensCreated = await teamAndAdvisorsAllocations.tokensTransferred();
                tokensCreated.should.be.bignumber.equal(0);

                await timer(dayInSecs * 100);

                await teamAndAdvisorsAllocations.unlock({
                    from: founder1
                });
                await teamAndAdvisorsAllocations.unlock({
                    from: founder2
                });

                const tokenBalanceFounder1 = await token.balanceOf(founder1);
                const tokenBalanceFounder2 = await token.balanceOf(founder2);
                tokenBalanceFounder1.should.be.bignumber.equal(800);
                tokenBalanceFounder2.should.be.bignumber.equal(1000);

                tokensCreated = await teamAndAdvisorsAllocations.tokensTransferred();
                tokensCreated.should.be.bignumber.equal(
                    expectedTeamAndAdvisorTokens
                );
            });
        });
    }
);
