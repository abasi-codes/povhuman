/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/verify_human.json`.
 */
export type VerifyHuman = {
  "address": "DbGavFV6xRvS5FKav7Xwrock9TEkemrNZkvnm2XDookF",
  "metadata": {
    "name": "verifyHuman",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "VerifyHuman escrow program — agents deposit SOL, humans earn by completing verified tasks"
  },
  "instructions": [
    {
      "name": "cancelAndRefund",
      "docs": [
        "Cancel a task and refund escrow SOL to the agent.",
        "Can be called by the authority or the agent."
      ],
      "discriminator": [
        86,
        34,
        75,
        82,
        239,
        186,
        2,
        228
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "taskId"
              }
            ]
          }
        },
        {
          "name": "agent",
          "docs": [
            "Agent who deposited — receives the refund."
          ],
          "writable": true
        },
        {
          "name": "signer",
          "docs": [
            "Authority or the agent can cancel."
          ],
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "taskId",
          "type": "string"
        }
      ]
    },
    {
      "name": "claimTask",
      "docs": [
        "Human claims an open task."
      ],
      "discriminator": [
        49,
        222,
        219,
        238,
        155,
        68,
        221,
        136
      ],
      "accounts": [
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "taskId"
              }
            ]
          }
        },
        {
          "name": "human",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "taskId",
          "type": "string"
        }
      ]
    },
    {
      "name": "completeAndRelease",
      "docs": [
        "Authority completes the task and releases escrow SOL to the human."
      ],
      "discriminator": [
        121,
        144,
        222,
        33,
        133,
        162,
        78,
        159
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "taskId"
              }
            ]
          }
        },
        {
          "name": "human",
          "docs": [
            "Human who completed the task — receives the escrowed SOL."
          ],
          "writable": true
        },
        {
          "name": "authority",
          "docs": [
            "The program authority."
          ],
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "taskId",
          "type": "string"
        },
        {
          "name": "verificationHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "createTask",
      "docs": [
        "Agent creates a task and deposits SOL into an escrow PDA."
      ],
      "discriminator": [
        194,
        80,
        6,
        180,
        232,
        127,
        48,
        171
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "taskId"
              }
            ]
          }
        },
        {
          "name": "agent",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "taskId",
          "type": "string"
        },
        {
          "name": "checkpointCount",
          "type": "u8"
        },
        {
          "name": "escrowLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "Initialize the program config with an authority.",
        "Called once after deployment."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "verifyCheckpoint",
      "docs": [
        "Authority verifies a checkpoint (called by the backend after Trio VLM confirms)."
      ],
      "discriminator": [
        119,
        187,
        26,
        193,
        230,
        216,
        64,
        10
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "taskId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "The program authority (backend server) that verifies checkpoints."
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "taskId",
          "type": "string"
        },
        {
          "name": "checkpointIndex",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "taskEscrow",
      "discriminator": [
        209,
        72,
        197,
        54,
        17,
        55,
        3,
        187
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidTaskStatus",
      "msg": "Task is not in the expected status for this operation"
    },
    {
      "code": 6001,
      "name": "zeroEscrow",
      "msg": "Escrow amount must be greater than zero"
    },
    {
      "code": 6002,
      "name": "alreadyClaimed",
      "msg": "Task has already been claimed"
    },
    {
      "code": 6003,
      "name": "notClaimed",
      "msg": "Task has not been claimed yet"
    },
    {
      "code": 6004,
      "name": "checkpointOutOfBounds",
      "msg": "Checkpoint index out of bounds"
    },
    {
      "code": 6005,
      "name": "checkpointAlreadyVerified",
      "msg": "Checkpoint already verified"
    },
    {
      "code": 6006,
      "name": "incompleteCheckpoints",
      "msg": "Not all required checkpoints have been verified"
    },
    {
      "code": 6007,
      "name": "unauthorizedAuthority",
      "msg": "Only the authority can perform this action"
    },
    {
      "code": 6008,
      "name": "unauthorizedAgent",
      "msg": "Only the agent can cancel this task"
    },
    {
      "code": 6009,
      "name": "taskIdTooLong",
      "msg": "Task ID exceeds maximum length"
    },
    {
      "code": 6010,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    }
  ],
  "types": [
    {
      "name": "config",
      "docs": [
        "Global program configuration. One per program deployment.",
        "PDA seeds: [\"config\"]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Program authority — can verify checkpoints and release escrow."
            ],
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "docs": [
              "Fee basis points taken on release (0 = no fee). Reserved for future use."
            ],
            "type": "u16"
          },
          {
            "name": "taskCount",
            "docs": [
              "Total tasks created (monotonic counter)."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for this PDA."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "taskEscrow",
      "docs": [
        "Per-task escrow account holding SOL.",
        "PDA seeds: [\"escrow\", task_id]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "taskId",
            "docs": [
              "The task identifier (e.g. \"task-wash-dishes\")."
            ],
            "type": "string"
          },
          {
            "name": "agent",
            "docs": [
              "Agent wallet that deposited the escrow."
            ],
            "type": "pubkey"
          },
          {
            "name": "human",
            "docs": [
              "Human wallet that claimed the task (Pubkey::default() if unclaimed)."
            ],
            "type": "pubkey"
          },
          {
            "name": "escrowLamports",
            "docs": [
              "Lamports held in escrow."
            ],
            "type": "u64"
          },
          {
            "name": "status",
            "docs": [
              "Task status: 0=Open, 1=Claimed, 2=Completed, 3=Cancelled"
            ],
            "type": "u8"
          },
          {
            "name": "checkpointCount",
            "docs": [
              "Number of checkpoints for this task."
            ],
            "type": "u8"
          },
          {
            "name": "checkpointsVerified",
            "docs": [
              "Number of checkpoints verified so far."
            ],
            "type": "u8"
          },
          {
            "name": "verifiedBitmap",
            "docs": [
              "Bitmap of verified checkpoints (up to MAX_CHECKPOINTS).",
              "Bit i is set when checkpoint i is verified."
            ],
            "type": "u16"
          },
          {
            "name": "verificationHash",
            "docs": [
              "SHA-256 verification hash (set on completion). 32 bytes."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp when escrow was created."
            ],
            "type": "i64"
          },
          {
            "name": "completedAt",
            "docs": [
              "Unix timestamp when task was completed (0 if not yet)."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for this PDA."
            ],
            "type": "u8"
          }
        ]
      }
    }
  ]
};
