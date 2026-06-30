// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VeritasRegistry {
    // The manufacturer (admin) who can provision or revoke cameras
    address public owner;

    // Maps a camera's public key (hex string) to its trust status
    // true = Valid hardware key
    // false = Not registered or revoked
    mapping(string => bool) private trustedDevices;

    // Events for transparency on the blockchain
    event DeviceRegistered(string publicKey, uint256 timestamp);
    event DeviceRevoked(string publicKey, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Veritas: caller is not the owner");
        _;
    }

    /**
     * @dev Registers a new hardware device public key.
     * Only the manufacturer (owner) can call this during factory provisioning.
     */
    function registerDevice(string memory publicKey) public onlyOwner {
        require(!trustedDevices[publicKey], "Veritas: Device already registered");
        trustedDevices[publicKey] = true;
        emit DeviceRegistered(publicKey, block.timestamp);
    }

    /**
     * @dev Revokes a hardware device public key if it is compromised.
     */
    function revokeDevice(string memory publicKey) public onlyOwner {
        require(trustedDevices[publicKey], "Veritas: Device not registered or already revoked");
        trustedDevices[publicKey] = false;
        emit DeviceRevoked(publicKey, block.timestamp);
    }

    /**
     * @dev Checks if a public key is trusted.
     * Public read-only function called by the Veritas API Gateway.
     */
    function isDeviceTrusted(string memory publicKey) public view returns (bool) {
        return trustedDevices[publicKey];
    }
}
