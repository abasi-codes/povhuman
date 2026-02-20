import "dotenv/config";
import { readFileSync } from "node:fs";
import { ethers } from "ethers";

const rpcUrl = process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const privateKey = process.env.ZG_PRIVATE_KEY;
if (!privateKey) {
  console.error("Set ZG_PRIVATE_KEY in .env");
  process.exit(1);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey!, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} A0GI`);

  if (balance === 0n) {
    console.error("Wallet has no funds. Get testnet tokens from https://faucet.0g.ai");
    process.exit(1);
  }

  const artifact = JSON.parse(
    readFileSync("artifacts/contracts/VerifyHumanReceipts.sol/VerifyHumanReceipts.json", "utf-8"),
  );

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log("Deploying VerifyHumanReceipts...");

  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\nVerifyHumanReceipts deployed to: ${address}`);
  console.log(`Set ZG_CONTRACT_ADDRESS=${address} in your .env`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
