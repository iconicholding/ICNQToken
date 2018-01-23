pragma solidity 0.4.18;

import './ICNQToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

/**
 * @title Team And Advisors contract - Keep locked ICNQ tokens allocated to team and advisors for a determined time.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */

contract TeamAndAdvisorsAllocation {
    using SafeMath for uint;
    address public owner;
    address public companyWallet;
    uint256 public unlockedAt;
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
     * @dev Adds founders' token allocation
     * @param teamOrAdvisorsAddress Address of a founder
     * @param allocationValue Number of tokens allocated to a founder
     * @return true if address is correctly added
     */
    function addTeamAndAdvisorsAllocation(address teamOrAdvisorsAddress, uint256 allocationValue)
        external
        onlyOwner
        returns(bool)
    {
        require(teamAndAdvisorsAllocations[teamOrAdvisorsAddress] == 0); // can only add once.

        teamAndAdvisorsAllocations[teamOrAdvisorsAddress] = allocationValue;
        return true;
    }

    /**
     * @dev Allow team and advisors to unlock allocated tokens by transferring them whitelisted addresses.
     * Need to be called by each address
     */
    function unlock() external {
        require(now >= unlockedAt);

        // During first unlock attempt fetch total number of locked tokens.
        if (tokensTransferred == 0) {
            tokensTransferred = icnq.balanceOf(this);
        }

        uint256 transferAllocation = teamAndAdvisorsAllocations[msg.sender];
        teamAndAdvisorsAllocations[msg.sender] = 0;

        // Will fail if allocation (and therefore toTransfer) is 0.
        require(icnq.transfer(msg.sender, transferAllocation));
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
