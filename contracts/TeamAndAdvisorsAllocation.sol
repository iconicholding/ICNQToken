pragma solidity 0.4.18;

import './ICNQToken.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

/**
 * @title Team And Advisors contract - Keep locked ICNQ tokens allocated to team and advisors for a determined time.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */

contract TeamAndAdvisorsAllocation is Ownable {
    using SafeMath for uint256;
    uint256 public unlockedAt;
    uint256 public tokensTransferred;

    mapping (address => uint256) public teamAndAdvisorsAllocations;

    ICNQToken public icnq;

    /**
     * @dev constructor function that sets owner and token for the TeamAndAdvisorsAllocation contract
     * @param token Token contract address for AllPublicArtToken
     * @param oneYearFromNowInTimestamp Timestamp representing one year in the future
     */
    function TeamAndAdvisorsAllocation(address token, uint256 oneYearFromNowInTimestamp) public {
        /* require(token != address(0) && oneYearFromNowInTimestamp > 0); */

        icnq = ICNQToken(token);
        unlockedAt = oneYearFromNowInTimestamp;
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
}
