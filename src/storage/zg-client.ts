import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { ethers } from "ethers";
import { ZgFile, Indexer } from "@0glabs/0g-ts-sdk";
import { logger } from "../logger.js";
import type { ZgUploadResult } from "./types.js";

interface ZgStorageConfig {
  rpcUrl: string;
  indexerUrl: string;
  privateKey: string;
}

export class ZgStorageClient {
  private config: ZgStorageConfig | null;
  private indexer: Indexer | null = null;
  private signer: ethers.Wallet | null = null;

  constructor(config: ZgStorageConfig | null) {
    this.config = config;
    if (config) {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      this.signer = new ethers.Wallet(config.privateKey, provider);
      this.indexer = new Indexer(config.indexerUrl);
    }
  }

  get isEnabled(): boolean {
    return this.config !== null;
  }

  async uploadFrame(
    frameB64: string,
    meta: { checkpoint_id: string; task_id: string },
  ): Promise<ZgUploadResult | null> {
    if (!this.config || !this.indexer || !this.signer) return null;

    const tmpPath = join(tmpdir(), `vh-frame-${nanoid(8)}.bin`);
    try {
      const buf = Buffer.from(frameB64, "base64");
      writeFileSync(tmpPath, buf);

      const zgFile = await ZgFile.fromFilePath(tmpPath);
      const [tree, treeErr] = await zgFile.merkleTree();
      if (treeErr || !tree) {
        logger.warn({ err: treeErr, ...meta }, "0G merkle tree generation failed");
        await zgFile.close();
        return null;
      }

      const merkleRoot = tree.rootHash();
      if (!merkleRoot) {
        logger.warn(meta, "0G merkle root is null");
        await zgFile.close();
        return null;
      }

      // Cast signer — 0G SDK imports ethers CJS types while we use ESM
      const [uploadResult, uploadErr] = await this.indexer.upload(
        zgFile,
        this.config.rpcUrl,
        this.signer as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      );
      await zgFile.close();

      if (uploadErr) {
        logger.warn({ err: uploadErr, ...meta }, "0G upload failed");
        return null;
      }

      logger.info({ merkleRoot, ...meta }, "Evidence frame uploaded to 0G Storage");
      return {
        merkle_root: merkleRoot,
        tx_hash: uploadResult?.txHash ?? null,
        uploaded_at: new Date().toISOString(),
        size_bytes: buf.length,
      };
    } catch (err) {
      logger.warn({ err, ...meta }, "0G upload error");
      return null;
    } finally {
      try { unlinkSync(tmpPath); } catch { /* already cleaned */ }
    }
  }

  async downloadFrame(merkleRoot: string): Promise<string | null> {
    if (!this.indexer) return null;

    const tmpPath = join(tmpdir(), `vh-dl-${nanoid(8)}.bin`);
    try {
      const err = await this.indexer.download(merkleRoot, tmpPath, true);
      if (err) {
        logger.warn({ err, merkleRoot }, "0G download failed");
        return null;
      }

      const buf = readFileSync(tmpPath);
      return buf.toString("base64");
    } catch (err) {
      logger.warn({ err, merkleRoot }, "0G download error");
      return null;
    } finally {
      try { unlinkSync(tmpPath); } catch { /* already cleaned */ }
    }
  }
}
