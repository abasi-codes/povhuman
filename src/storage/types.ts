export interface ZgUploadResult {
  merkle_root: string;
  tx_hash: string | null;
  uploaded_at: string;
  size_bytes: number;
}
