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
    uint256 constant public presaleSupply = 666667e18; // 666,667
    uint256 constant public totalSupplyForCrowdsale = 8000000e18; // 8M
    uint256 public constant COMPANY_SHARE = 1600000e18; // 1.6M
    uint256 public constant TEAM_ADVISORS_SHARE = 4033333e18; // 4,033, 333
    uint256 public constant BOUNTY_CAMPAIGN_SHARE = 1600000e18; // 1.6M

    address public bountyCampaignWallet;
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
            address _wallet,
            address _bountyCampaignWallet
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

        bountyCampaignWallet = _bountyCampaignWallet;

        ICNQToken(token).pause();
    }

    /**
     * @dev Creates ICNQ token contract. This is called on the constructor function of the Crowdsale contract
     */
    function createTokenContract() internal returns (MintableToken) {
        return new ICNQToken();
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
      * @dev Mint tokens for company, team & advisors, and bounty campaign
      */
     function mintCompanyTokens() internal {
         teamAndAdvisorsAllocation = new TeamAndAdvisorsAllocation(owner, token);

         token.mint(wallet, COMPANY_SHARE);
         token.mint(bountyCampaignWallet, BOUNTY_CAMPAIGN_SHARE);
         token.mint(teamAndAdvisorsAllocation, TEAM_ADVISORS_SHARE);
     }
}
