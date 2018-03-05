pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/crowdsale/FinalizableCrowdsale.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./ICNQToken.sol";
import "./Whitelist.sol";


/**
 * @title ICNQ Crowdsale contract - crowdsale contract for the ICNQ tokens.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */
contract ICNQCrowdsale is FinalizableCrowdsale, Pausable {
    uint256 public presaleEndTime;

    // token supply figures
    uint256 constant public TOTAL_TOKENS_SUPPLY = 20000000e18; // 20M

    uint256 public constant OPTIONAL_POOL = 4650000e18; // 4.65M
    uint256 public constant FINLAB_PRESALE = 2000000e18; // 2M
    uint256 public constant EOS = 2000000e18; // 2M
    uint256 public constant US_INSTITUTIONAL = 1500000e18; // 1.5M
    uint256 public constant PRIVATE_SALE_TOTAL = OPTIONAL_POOL + FINLAB_PRESALE + EOS + US_INSTITUTIONAL; // 10.15M

    // 10.15 of the private sale + 750K for presale
    uint256 constant public PRE_SALE_TOTAL_TOKENS = PRIVATE_SALE_TOTAL + 750000e18;
    // 10.15 of the private sale + 750K for presale + 3M for crowdsale
    uint256 constant public TOTAL_TOKENS_FOR_CROWDSALE = PRE_SALE_TOTAL_TOKENS + 3000000e18;

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

    // external contracts
    Whitelist public whitelist;

    /**
     * @dev Contract constructor function
     * @param _startTime The timestamp of the beginning of the crowdsale
     * @param _presaleEndTime End of presale in timestamp
     * @param _endTime Timestamp when the crowdsale will finish
     * @param _whitelist contract containing the whitelisted addresses
     * @param _rate The token rate per ETH
     * @param _wallet Multisig wallet that will hold the crowdsale funds.
     */
    function ICNQCrowdsale
        (
            uint256 _startTime,
            uint256 _presaleEndTime,
            uint256 _endTime,
            address _whitelist,
            uint256 _rate,
            address _wallet
        )
        public
        FinalizableCrowdsale()
        Crowdsale(_startTime, _endTime, _rate, _wallet)
    {
        require(_whitelist != address(0));

        presaleEndTime = _presaleEndTime;
        whitelist = Whitelist(_whitelist);
        ICNQToken(token).pause();
    }

    modifier whitelisted(address beneficiary) {
        require(whitelist.isWhitelisted(beneficiary));
        _;
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
        // only able to set teamAndAdvisorsAllocation once.
        // TeamAndAdvisorsAllocation contract requires token contract already deployed.
        // token contract is created within crowdsale,
        // thus the TeamAndAdvisorsAllocation must be set up after crowdsale's deployment
        require(teamAndAdvisorsAllocation == address(0x0) && _teamAndAdvisorsAllocation != address(0x0));

        teamAndAdvisorsAllocation = _teamAndAdvisorsAllocation;
    }

    /**
     * @dev payable function that allow token purchases
     * @param beneficiary Address of the purchaser
     */
    function buyTokens(address beneficiary)
        public
        whenNotPaused
        whitelisted(beneficiary)
        payable
    {
        // minimum of 1 ether for purchase in the public presale and sale
        require(beneficiary != address(0) && msg.value >= 1 ether);
        require(validPurchase() && token.totalSupply() < TOTAL_TOKENS_FOR_CROWDSALE);

        uint256 weiAmount = msg.value;

        // calculate token amount to be created
        uint256 tokens = weiAmount.mul(rate);

        if (now >= startTime && now <= presaleEndTime) {
            uint256 bonus = 50;
            uint256 bonusTokens = tokens.mul(bonus).div(100);

            tokens = tokens.add(bonusTokens);
            require(token.totalSupply().add(tokens) <= PRE_SALE_TOTAL_TOKENS);
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
     * @dev Creates ICNQ token contract. This is called on the constructor function of the Crowdsale contract
     */
    function createTokenContract() internal returns (MintableToken) {
        return new ICNQToken();
    }
}
