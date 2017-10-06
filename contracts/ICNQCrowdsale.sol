pragma solidity ^0.4.13;

import "zeppelin-solidity/contracts/crowdsale/CappedCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/FinalizableCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/RefundableCrowdsale.sol";
import "./ICNQtoken.sol";

contract ICNQCrowdsale is CappedCrowdsale, RefundableCrowdsale {
    uint256 public presaleEndTime;

    // token supply figures
    uint256 constant public totalSupplyToken = 16000000e18;
    uint256 constant public presaleSupply = 666667e18;
    uint256 constant public totalSupplyForCrowdsale = 8000000e18;
    uint256 public constant COMPANY_SHARE = 1600000e18;
    uint256 public constant TEAM_ADVISORS_SHARE = 4033333e18;
    uint256 public constant BOUNTY_CAMPAIGN_SHARE = 1600000e18;

    function ICNQCrowdsale
        (
            uint256 _startTime,
            uint256 _presaleEndTime,
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
        ICNQToken(token).pause();

        presaleEndTime = _presaleEndTime;

        require(_goal <= _cap);
    }

    /**
     * @dev Creates ICNQ token contract. This is called on the constructor function of the Crowdsale contract
     */
    function createTokenContract() internal returns (MintableToken) {
        return new ICNQToken();
    }
}
