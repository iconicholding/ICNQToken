pragma solidity ^0.4.13;

import "zeppelin-solidity/contracts/crowdsale/CappedCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/FinalizableCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/RefundableCrowdsale.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./TeamAndAdvisorsAllocation.sol";
import "./ICNQToken.sol";

contract ICNQCrowdsale is CappedCrowdsale, RefundableCrowdsale, Pausable {
    // bonus milestones
    uint256 public presaleEndTime;
    uint256 public firstBonusEndTime;
    uint256 public secondBonusEndTime;

    // token supply figures
    uint256 constant public totalSupplyToken = 16000000e18; // 1.6M
    uint256 constant public presaleSupply = 700000e18; // 700K
    uint256 constant public totalSupplyForCrowdsale = 8000000e18; // 8M
    uint256 public constant COMPANY_SHARE = 1600000e18; // 1.6M
    uint256 public constant TEAM_ADVISORS_SHARE = 4033333e18; // 4,033,333
    uint256 public constant BOUNTY_CAMPAIGN_SHARE = 1600000e18; // 1.6M

    TeamAndAdvisorsAllocation public teamAndAdvisorsAllocation;

    function ICNQCrowdsale
        (
            uint256 _startTime,
            uint256 _presaleEndTime,
            uint256 _firstBonusEndTime,
            uint256 _secondBonusEndTime,
            uint256 _endTime,
            uint256 _rate,
            uint256 _goal,
            uint256 _cap,
            address _wallet
        )

        CappedCrowdsale(_cap)
        FinalizableCrowdsale()
        RefundableCrowdsale(_goal)
        Crowdsale(_startTime, _endTime, _rate, _wallet)
    {
        require(_goal <= _cap);

        // setup for token bonus milestones
        presaleEndTime = _presaleEndTime;
        firstBonusEndTime = _firstBonusEndTime;
        secondBonusEndTime = _secondBonusEndTime;

        ICNQToken(token).pause();
    }

    /**
     * @dev Creates ICNQ token contract. This is called on the constructor function of the Crowdsale contract
     */
    function createTokenContract() internal returns (MintableToken) {
        return new ICNQToken();
    }

    /**
     * @dev payable function that allow token purchases
     * @param beneficiary Address of the purchaser
     */
    function buyTokens(address beneficiary)
        public
        whenNotPaused
        payable
    {
        require(beneficiary != address(0));
        require(validPurchase());

        if (now >= startTime && now <= presaleEndTime)
            require(checkPreSaleCap());

        uint256 weiAmount = msg.value;
        uint256 bonus = getBonusTier();

        // calculate token amount to be created
        uint256 tokens = weiAmount.mul(rate);

        if (bonus > 0) {
            uint256 tokensIncludingBonus = tokens.mul(bonus).div(100);

            tokens = tokens.add(tokensIncludingBonus);
        }

        // update state
        weiRaised = weiRaised.add(weiAmount);

        token.mint(beneficiary, tokens);

        TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

        forwardFunds();
    }

    /**
     * @dev finalizes crowdsale
     */
    function finalization() internal {
       mintCompanyTokens();

       super.finalization();
    }

    /**
     * @dev triggers token transfer mechanism. To be used after the crowdsale is finished
     */
    function unpauseToken() onlyOwner {
        require(isFinalized);
        ICNQToken(token).unpause();
    }

    /**
     * @dev Pauses token transfers. Only used after crowdsale finishes
     */
    function pauseToken() onlyOwner {
        require(isFinalized);
        ICNQToken(token).pause();
    }

    /**
     * internal functions
     */

     /**
     * @dev checks whether it is pre sale and if there is minimum purchase requirement
     * @return truthy if purchase is equal or more than 10 ether
     */
     function checkPreSaleCap() internal returns (bool) {
        return token.totalSupply() <= presaleSupply;
     }

     /**
     * @dev Fetches Bonus tier percentage per bonus milestones
     * @return uint256 representing percentage of the bonus tier
     */
    function getBonusTier() internal returns (uint256) {
        bool preSalePeriod = now >= startTime && now <= presaleEndTime; //  50% bonus
        bool firstBonusSalesPeriod = now >= presaleEndTime && now <= firstBonusEndTime; // 10% bonus
        bool secondBonusSalesPeriod = now > firstBonusEndTime && now <= secondBonusEndTime; // 5% bonus
        bool thirdBonusSalesPeriod = now > secondBonusEndTime; //  0% bonus

        if (preSalePeriod) return 50;
        if (firstBonusSalesPeriod) return 10;
        if (secondBonusSalesPeriod) return 15;
        if (thirdBonusSalesPeriod) return 0;
    }

     /**
      * @dev Mint tokens for company, team & advisors, and bounty campaign
      */
     function mintCompanyTokens() internal {
         teamAndAdvisorsAllocation = new TeamAndAdvisorsAllocation(owner, token);

         token.mint(wallet, COMPANY_SHARE);
         token.mint(wallet, BOUNTY_CAMPAIGN_SHARE); // allocate BOUNTY_CAMPAIGN_SHARE to company wallet as well
         token.mint(teamAndAdvisorsAllocation, TEAM_ADVISORS_SHARE);
     }
}
