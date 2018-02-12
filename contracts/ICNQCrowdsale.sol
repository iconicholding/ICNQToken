pragma solidity 0.4.19;

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
    uint256 constant public TOTAL_TOKENS_SUPPLY = 12000000e18; // 12M
    uint256 constant public TOTAL_TOKENS_FOR_CROWDSALE = 6500000e18; // 6.5M
    uint256 constant public PRE_SALE_TOTAL_TOKENS = 750000e18; // 750K

    uint256 public constant INSTITUTIONAL_SHARE = 4650000e18; // 4.65M
    uint256 public constant FRIENDS_AND_FAMILY_PRE_SALE = 2000000e18; // 2M
    uint256 public constant PRIVATE_SALE_TOTAL = INSTITUTIONAL_SHARE + FRIENDS_AND_FAMILY_PRE_SALE;

    uint256 public constant TEAM_ADVISORS_SHARE = 3100000e18; // 3.1M
    uint256 public constant COMPANY_SHARE = 2000000e18; // 2M
    uint256 public constant BOUNTY_CAMPAIGN_SHARE = 1000000e18; // 1M

    address public teamAndAdvisorsAllocation;

    // remainderPurchaser and remainderTokens info saved in the contract
    // used for reference for contract owner to send refund if any to last purchaser after end of crowdsale
    address public remainderPurchaser;
    uint256 public remainderAmount;

    event PrivateInvestorTokenPurchase(address indexed investor, uint256 tokensPurchased);
    event TokenRateChanged(uint256 previousRate, uint256 newRate);

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
     * @dev Mint tokens for private investors before crowdsale starts
     * @param investorsAddress Purchaser's address
     * @param tokensPurchased Tokens purchased during pre crowdsale
     */
    function mintTokenForPrivateInvestors(address investorsAddress, uint256 tokensPurchased)
        external
        onlyOwner
    {
        require(now < startTime && investorsAddress != address(0));
        require(token.totalSupply().add(tokensPurchased) <= PRIVATE_SALE_TOTAL);

        token.mint(investorsAddress, tokensPurchased);
        PrivateInvestorTokenPurchase(investorsAddress, tokensPurchased);
    }

    /**
     * @dev change crowdsale rate
     * @param newRate Figure that corresponds to the new rate per token
     */
    function setRate(uint256 newRate) external onlyOwner {
        require(newRate != 0);

        TokenRateChanged(rate, newRate);
        rate = newRate;
    }

    /**
     * @dev Set the address which should receive the vested team tokens share on finalization
     * @param _teamAndAdvisorsAllocation address of team and advisor allocation contract
     */
    function setTeamWalletAddress(address _teamAndAdvisorsAllocation) public onlyOwner {
        require(_teamAndAdvisorsAllocation != address(0x0));
        teamAndAdvisorsAllocation = _teamAndAdvisorsAllocation;
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
        require(validPurchase() && token.totalSupply() <= TOTAL_TOKENS_FOR_CROWDSALE);

        if (now >= startTime && now <= presaleEndTime)
            require(token.totalSupply() <= PRE_SALE_TOTAL_TOKENS);

        uint256 weiAmount = msg.value;
        uint256 bonus = getBonusTier();

        // calculate token amount to be created
        uint256 tokens = weiAmount.mul(rate);

        if (bonus > 0) {
            uint256 tokensIncludingBonus = tokens.mul(bonus).div(100);

            tokens = tokens.add(tokensIncludingBonus);
        }

        //remainder logic
        if (token.totalSupply().add(tokens) > TOTAL_TOKENS_FOR_CROWDSALE) {
            tokens = TOTAL_TOKENS_FOR_CROWDSALE.sub(token.totalSupply());
            weiAmount = tokens.div(rate);

            // save info so as to refund purchaser after crowdsale's end
            remainderPurchaser = msg.sender;
            remainderAmount = msg.value.sub(weiAmount);
        }

        // update state
        weiRaised = weiRaised.add(weiAmount);

        token.mint(beneficiary, tokens);

        TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

        forwardFunds();
    }

    // overriding Crowdsale#hasEnded to add cap logic
    // @return true if crowdsale event has ended
    function hasEnded() public view returns (bool) {
        if (token.totalSupply() == TOTAL_TOKENS_FOR_CROWDSALE) {
            return true;
        }

        return super.hasEnded();
    }

    /**
     * @dev finalizes crowdsale
     */
    function finalization() internal {
        // This must have been set manually prior to finalize().
        require(teamAndAdvisorsAllocation != address(0));

        token.mint(wallet, COMPANY_SHARE);
        token.mint(wallet, BOUNTY_CAMPAIGN_SHARE); // allocate BOUNTY_CAMPAIGN_SHARE to company wallet as well
        token.mint(teamAndAdvisorsAllocation, TEAM_ADVISORS_SHARE);

        if (TOTAL_TOKENS_SUPPLY > token.totalSupply()) {
            uint256 remainingTokens = TOTAL_TOKENS_SUPPLY.sub(token.totalSupply());
            // burn remaining tokens
            token.mint(address(0), remainingTokens);
        }

        token.finishMinting();
        ICNQToken(token).unpause();
        super.finalization();
    }

    /**
     * internal functions
     */

     /**
     * @dev Fetches Bonus tier percentage per bonus milestones
     * @return uint256 representing percentage of the bonus tier
     */
    function getBonusTier() internal view returns (uint256) {
        bool preSalePeriod = now >= startTime && now <= presaleEndTime; //  50% bonus
        bool firstBonusSalesPeriod = now > presaleEndTime && now <= firstBonusEndTime; // 10% bonus
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
