/**
 * Initialize the VerifyHuman Anchor program.
 * Run once after deployment: npx tsx scripts/init-program.ts
 */
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import idlJson from "../src/chain/idl/verify_human.json" assert { type: "json" };

const RPC_URL = process.env.SOLANA_RPC_URL || "http://127.0.0.1:8899";
const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR || join(process.env.HOME!, ".config/solana/id.json");

async function main() {
  // Load authority keypair
  const keypairData = JSON.parse(readFileSync(KEYPAIR_PATH, "utf-8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log("Authority:", authority.publicKey.toBase58());

  // Connect
  const connection = new Connection(RPC_URL, "confirmed");
  const balance = await connection.getBalance(authority.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  // Set up provider
  const wallet = {
    publicKey: authority.publicKey,
    signTransaction: async (tx: any) => { tx.partialSign(authority); return tx; },
    signAllTransactions: async (txs: any[]) => { txs.forEach(tx => tx.partialSign(authority)); return txs; },
  };
  const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });

  // Load program
  const program = new Program(idlJson as any, provider);
  const programId = new PublicKey(idlJson.address);
  console.log("Program:", programId.toBase58());

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId,
  );
  console.log("Config PDA:", configPda.toBase58());

  // Check if already initialized
  try {
    const existing = await (program.account as any).config.fetch(configPda);
    console.log("Program already initialized!");
    console.log("  Authority:", existing.authority.toBase58());
    console.log("  Fee BPS:", existing.feeBps);
    console.log("  Task count:", existing.taskCount.toString());
    return;
  } catch {
    console.log("Config PDA not found — initializing...");
  }

  // Call initialize with 0 fee
  const tx = await program.methods
    .initialize(0) // 0 fee basis points
    .accounts({
      config: configPda,
      authority: authority.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Initialize tx:", tx);

  // Verify
  const config = await (program.account as any).config.fetch(configPda);
  console.log("Initialized!");
  console.log("  Authority:", config.authority.toBase58());
  console.log("  Fee BPS:", config.feeBps);
  console.log("  Task count:", config.taskCount.toString());
}

main().catch(console.error);
