pragma solidity 0.4.18;

import "zeppelin-solidity/contracts/crowdsale/FinalizableCrowdsale.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./TeamAndAdvisorsAllocation.sol";
import "./ICNQToken.sol";

/**
 * @title ICNQ Crowdsale contract - crowdsale contract for the ICNQ tokens.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */

contract ICNQCrowdsale is FinalizableCrowdsale, Pausable {
    // bonus milestones
    uint256 public presaleEndTime;
    uint256 public firstBonusEndTime;
    uint256 public secondBonusEndTime;

    // token supply figures
    uint256 constant public PRE_SALE = 750000e18; // 750K
    uint256 constant public TOTAL_CROWDSALE = 12000000e18; // 12M
    uint256 public constant COMPANY_SHARE = 2000000e18; // 2M
    uint256 public constant TEAM_ADVISORS_SHARE = 4000000e18; // 4M
    uint256 public constant BOUNTY_CAMPAIGN_SHARE = 2000000e18; // 2M

    TeamAndAdvisorsAllocation public teamAndAdvisorsAllocation;

    function ICNQCrowdsale
        (
            uint256 _startTime,
            uint256 _presaleEndTime,
            uint256 _firstBonusEndTime,
            uint256 _secondBonusEndTime,
            uint256 _endTime,
            uint256 _rate,
            address _wallet
        )
        public
        FinalizableCrowdsale()
        Crowdsale(_startTime, _endTime, _rate, _wallet)
    {
        // setup for token bonus milestones
        presaleEndTime = _presaleEndTime;
        firstBonusEndTime = _firstBonusEndTime;
        secondBonusEndTime = _secondBonusEndTime;

        ICNQToken(token).pause();
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
        require(validPurchase() && token.totalSupply() <= TOTAL_CROWDSALE);

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
        teamAndAdvisorsAllocation = new TeamAndAdvisorsAllocation(owner, token, wallet);

        token.mint(wallet, COMPANY_SHARE);
        token.mint(wallet, BOUNTY_CAMPAIGN_SHARE); // allocate BOUNTY_CAMPAIGN_SHARE to company wallet as well
        token.mint(teamAndAdvisorsAllocation, TEAM_ADVISORS_SHARE);

        ICNQToken(token).unpause();
        super.finalization();
    }

    /**
     * internal functions
     */

     /**
     * @dev checks whether it is pre sale and if there is minimum purchase requirement
     * @return truthy if token total supply is less than PRE_SALE
     */
    function checkPreSaleCap() internal returns (bool) {
        return token.totalSupply() <= PRE_SALE;
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
     * @dev Creates ICNQ token contract. This is called on the constructor function of the Crowdsale contract
     */
    function createTokenContract() internal returns (MintableToken) {
        return new ICNQToken();
    }
}
