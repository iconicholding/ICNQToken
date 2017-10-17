pragma solidity ^0.4.13;

import './ICNQToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

contract TeamAndAdvisorsAllocation {
    using SafeMath for uint;
    address public owner;
    uint256 public unlockedAt;
    uint256 public secondUnlockedAt;
    uint256 public killableCall;
    uint256 public tokensCreated = 0;
    uint256 public allocatedTokens = 0;
    uint256 totalTeamAndAdvisorsAllocation = 4033333e18;

    mapping (address => uint256) public teamAndAdvisorsAllocations;

    ICNQToken icnq;

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
    function TeamAndAdvisorsAllocation(address _owner, address token) {
        icnq = ICNQToken(token);
        unlockedAt = now.add(180 days);
        secondUnlockedAt = now.add(360 days);
        killableCall = now.add(540 days);
        owner = _owner;
    }

    /**
     * @dev Adds founders' token allocation
     * @param beneficiaryAddress Address of a founder
     * @param allocationValue Number of tokens allocated to a founder
     * @return true if address is correctly added
     */
    function addTeamAndAdvisorsAllocation(address beneficiaryAddress, uint256 allocationValue)
        external
        onlyOwner
        returns(bool)
    {
        assert(teamAndAdvisorsAllocations[beneficiaryAddress] == 0); // can only add once.

        allocatedTokens = allocatedTokens.add(allocationValue);
        require(allocatedTokens <= totalTeamAndAdvisorsAllocation);

        teamAndAdvisorsAllocations[beneficiaryAddress] = allocationValue;
        return true;
    }

    /**
     * @dev Allow team and advisors to unlock allocated tokens by transferring them whitelisted addresses. Need to be called by each address
     */
    function unlock() external {
        assert(now >= unlockedAt);

        // During first unlock attempt fetch total number of locked tokens.
        if (tokensCreated == 0) {
            tokensCreated = icnq.balanceOf(this);
        }

        uint256 transferAllocation;
        if (now < secondUnlockedAt) {
            transferAllocation = teamAndAdvisorsAllocations[msg.sender].div(2);
            teamAndAdvisorsAllocations[msg.sender] = teamAndAdvisorsAllocations[msg.sender].sub(transferAllocation);
        } else if (now >= secondUnlockedAt) {
            transferAllocation = teamAndAdvisorsAllocations[msg.sender];
            teamAndAdvisorsAllocations[msg.sender] = 0;
        }

        // Will fail if allocation (and therefore toTransfer) is 0.
        require(icnq.transfer(msg.sender, transferAllocation));
    }

    /**
     * @dev allow for selfdestruct possibility and sending funds to owner
     */
    function kill() onlyOwner() {
        assert (now >= killableCall);
        uint256 balance = icnq.balanceOf(this);

        if (balance > 0) {
 		    icnq.transfer(owner, balance);
 		}

        selfdestruct(owner);
    }
}
