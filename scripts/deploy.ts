import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const factory = await ethers.getContractFactory("VerifyHumanReceipts");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`VerifyHumanReceipts deployed to: ${address}`);
  console.log(`Set ZG_CONTRACT_ADDRESS=${address} in your .env`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
