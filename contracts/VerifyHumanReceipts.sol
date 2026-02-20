// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VerifyHumanReceipts {
    struct Receipt {
        bytes32 verificationHash;
        uint32 checkpointCount;
        uint64 timestamp;
        bool exists;
    }

    address public owner;
    mapping(bytes32 => Receipt) public receipts;

    event VerificationRecorded(
        bytes32 indexed taskIdHash,
        bytes32 verificationHash,
        uint32 checkpointCount,
        uint64 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function recordVerification(
        string calldata taskId,
        bytes32 verificationHash,
        uint32 checkpointCount
    ) external onlyOwner {
        bytes32 taskIdHash = keccak256(bytes(taskId));
        require(!receipts[taskIdHash].exists, "Already recorded");

        receipts[taskIdHash] = Receipt({
            verificationHash: verificationHash,
            checkpointCount: checkpointCount,
            timestamp: uint64(block.timestamp),
            exists: true
        });

        emit VerificationRecorded(taskIdHash, verificationHash, checkpointCount, uint64(block.timestamp));
    }

    function verifyTask(string calldata taskId) external view returns (bytes32, uint32, uint64, bool) {
        bytes32 taskIdHash = keccak256(bytes(taskId));
        Receipt memory r = receipts[taskIdHash];
        return (r.verificationHash, r.checkpointCount, r.timestamp, r.exists);
    }

    function verifyByHash(bytes32 taskIdHash) external view returns (bytes32, uint32, uint64, bool) {
        Receipt memory r = receipts[taskIdHash];
        return (r.verificationHash, r.checkpointCount, r.timestamp, r.exists);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
