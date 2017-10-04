pragma solidity ^0.4.13;

import "zeppelin-solidity/contracts/token/MintableToken.sol";
import "zeppelin-solidity/contracts/token/PausableToken.sol";
import "zeppelin-solidity/contracts/token/BurnableToken.sol";

/**
 * @title Zulu Token contract - ERC20 compatible token contract.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */
contract ICNQToken is BurnableToken, PausableToken, MintableToken {
    string public constant name = "Iconiq Lab Token";
    string public constant symbol = "ICNQ";
    uint8 public constant decimals = 18;

    /**
     * @dev makes a number token unused forever
     * @param _value Number of tokens to burn
     */
    function burn(uint256 _value) public {
        super.burn(_value);
    }
}
