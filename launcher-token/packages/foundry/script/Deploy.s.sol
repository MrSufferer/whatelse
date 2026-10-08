// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Live deployment is wallet-signed in /operator. This entrypoint deliberately cannot broadcast.
contract DeployScript {
    function run() external pure {
        revert("Use the reviewed /operator wallet flow; never export a private key");
    }
}
