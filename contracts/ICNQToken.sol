pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/token/MintableToken.sol";
import "zeppelin-solidity/contracts/token/PausableToken.sol";

/**
 * @title ICNQ Token contract - ERC20 compatible token contract.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */
contract ICNQToken is PausableToken, MintableToken {
    string public constant name = "Iconiq Lab Token";
    string public constant symbol = "ICNQ";
    uint8 public constant decimals = 18;
}
