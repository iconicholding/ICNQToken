pragma solidity 0.4.18;

import './ICNQToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

contract TeamAndAdvisorsAllocation {
    using SafeMath for uint;
    address public owner;
    address public companyWallet;
    uint256 public unlockedAt;
    uint256 public killableCall;
    uint256 public tokensTransferred;

    mapping (address => uint256) public teamAndAdvisorsAllocations;

    ICNQToken public icnq;

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
     * @dev constructor function that sets owner and token for the TeamAndAdvisorsAllocation contract
     * @param _owner Contract owner
     * @param token Token contract address for AllPublicArtToken
     */
    function TeamAndAdvisorsAllocation(address _owner, address token, address _companyWallet) public {
        icnq = ICNQToken(token);
        unlockedAt = now.add(360 days);
        owner = _owner;
        companyWallet = _companyWallet;
    }

    /**
     * @dev Allow team and advisors to unlock allocated tokens by transferring them whitelisted addresses.
     * Need to be called by each address
     */
    function unlock() external onlyOwner {
        assert(now >= unlockedAt);

        // During first unlock attempt fetch total number of locked tokens.
        if (tokensTransferred == 0) {
            tokensTransferred = icnq.balanceOf(this);
        }

        // Will fail if allocation (and therefore toTransfer) is 0.
        require(icnq.transfer(companyWallet, tokensTransferred));
    }

    /**
     * @dev change contract owner
     * @param newOwner Replace for owner
     */
    function changeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0) && newOwner != owner);
        owner = newOwner;
    }
}
