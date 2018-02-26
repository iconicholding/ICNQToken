# ICNQ Token and Crowdsale Smart Contracts

## Development

**Dependencies**

* `node@8.5.x`
* `truffle@^4.0.1`
* `ganache-cli@^6.0.x`
* `zeppelin-solidity@1.4.X`

## Setting Up

* Clone this repository.

* Install all [system dependencies](#development).

  * `npm install`

* Compile contract code
  * `node_modules/.bin/truffle compile`

## Running Tests

    * `bash run_test.sh`

# If you work on these contracts, write tests!

**Testing Pattern**

* a good pattern to use, when testing restrictions on contract is to structure this way:

```javascript
describe('testing user restriction', function() {
    beforeEach('deploy and prepare', () => {
        // Deploy a contract(s) and prepare it up
        // to the pass / fail point
    });

    it('test the failing user', () => {
        // Test something with the bad user
        // in as few steps as possible
    });

    it('test the good user', () => {
        // Test the VERY SAME steps,
        // with only difference being the good user
    });
});
```
