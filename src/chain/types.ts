export interface ChainReceipt {
  tx_hash: string;
  block_number: number;
  contract_address: string;
  chain_id: number;
  task_id_hash: string;
  explorer_url: string;
}
