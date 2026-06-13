### **ChatGPT**

Below is the schema pack + state machines for the Federation Starter Kit. It’s opinionated: strict, versioned, hash-friendly, and designed for deterministic enforcement.
Everything here assumes JSON Schema 2020-12 and “no unknown fields” via additionalProperties: false.

1) Common Primitives
1.1 Message Envelope Schema

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/schemas/message\_envelope.v0.1.json",  "title": "TreatyNet Message Envelope v0.1",  "type": "object",  "additionalProperties": false,  "required": ["msg\_id", "ts", "from", "to", "type", "version", "nonce", "payload", "sig"],  "properties": {    "msg\_id": { "type": "string", "format": "uuid" },    "ts": { "type": "string", "format": "date-time" },    "from": { "type": "string", "minLength": 3 },    "to": { "type": "string", "minLength": 3 },    "type": { "type": "string", "minLength": 3 },    "version": { "type": "string", "pattern": "^0\\\\.1$" },    "nonce": { "type": "string", "minLength": 16, "maxLength": 256 },    "payload": { "type": "object" },    "sig": {      "type": "object",      "additionalProperties": false,      "required": ["alg", "kid", "signature"],      "properties": {        "alg": { "type": "string", "enum": ["ed25519", "secp256k1", "p256"] },        "kid": { "type": "string", "minLength": 3, "maxLength": 128 },        "signature": { "type": "string", "minLength": 32, "maxLength": 8192 }      }    }  }}
\`\`\`

1.2 Evidence Reference Schema

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/schemas/evidence\_ref.v0.1.json",  "title": "Evidence Reference v0.1",  "type": "object",  "additionalProperties": false,  "required": ["type", "ref"],  "properties": {    "type": {      "type": "string",      "enum": ["ledger\_slice", "attestation", "document\_hash", "object\_store\_ref", "tx\_ref"]    },    "ref": { "type": "string", "minLength": 8, "maxLength": 2048 }  }}
\`\`\`

1.3 Hash Schema (for policy hashes, rule hashes, etc.)

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/schemas/hash.v0.1.json",  "title": "Hash v0.1",  "type": "string",  "pattern": "^[a-fA-F0-9]{64}$"}
\`\`\`

2) Treaty Schema
2.1 Treaty Object Schema (v0.1)

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/schemas/treaty.v0.1.json",  "title": "Treaty Object v0.1",  "type": "object",  "additionalProperties": false,  "required": [    "treaty\_id",    "version",    "participants",    "state",    "effective\_ts",    "expiry\_ts",    "modules",    "caps",    "proof\_requirements",    "amendment\_history"  ],  "properties": {    "treaty\_id": { "type": "string", "pattern": "^treaty:[a-z0-9\\\\-\_.]+$" },    "version": { "type": "string", "pattern": "^0\\\\.1$" },    "participants": {      "type": "array",      "minItems": 2,      "maxItems": 8,      "items": { "type": "string", "minLength": 3 },      "uniqueItems": true    },    "state": {      "type": "string",      "enum": ["draft", "active", "suspended", "terminating", "terminated"]    },    "effective\_ts": { "type": "string", "format": "date-time" },    "expiry\_ts": { "type": "string", "format": "date-time" },    "caps": {      "type": "object",      "additionalProperties": false,      "required": ["max\_notional", "max\_draws\_per\_window", "window\_days"],      "properties": {        "max\_notional": { "type": "number", "minimum": 0 },        "max\_draws\_per\_window": { "type": "integer", "minimum": 0, "maximum": 1000 },        "window\_days": { "type": "integer", "minimum": 1, "maximum": 365 }      }    },    "proof\_requirements": {      "type": "object",      "additionalProperties": false,      "required": ["solvency", "cadence\_days", "proof\_expiry\_days"],      "properties": {        "solvency": {          "type": "string",          "enum": ["custodian\_attestation", "merkle\_balances", "audited\_statement"]        },        "cadence\_days": { "type": "integer", "minimum": 1, "maximum": 90 },        "proof\_expiry\_days": { "type": "integer", "minimum": 1, "maximum": 30 }      }    },    "modules": {      "type": "array",      "minItems": 1,      "maxItems": 20,      "items": { "$ref": "https://treatynet.dev/schemas/treaty\_module.v0.1.json" }    },    "amendment\_history": {      "type": "array",      "minItems": 0,      "maxItems": 5000,      "items": { "$ref": "https://treatynet.dev/schemas/treaty\_amendment.v0.1.json" }    }  }}
\`\`\`

2.2 Treaty Module Schema (v0.1)

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/schemas/treaty\_module.v0.1.json",  "title": "Treaty Module v0.1",  "type": "object",  "additionalProperties": false,  "required": ["module", "terms"],  "properties": {    "module": {      "type": "string",      "enum": [        "liquidity\_backstop",        "outcome\_swap",        "compute\_exchange",        "attention\_exchange",        "dispute\_resolution",        "solvency\_proofs",        "manufacturing\_throughput",        "logistics\_throughput",        "regulatory\_capacity"      ]    },    "terms": { "type": "object" }  },  "allOf": [    {      "if": { "properties": { "module": { "const": "liquidity\_backstop" } } },      "then": { "$ref": "https://treatynet.dev/schemas/module\_liquidity\_backstop.v0.1.json" }    },    {      "if": { "properties": { "module": { "const": "dispute\_resolution" } } },      "then": { "$ref": "https://treatynet.dev/schemas/module\_dispute\_resolution.v0.1.json" }    }  ]}
\`\`\`

2.3 Amendment Schema (diff + hash chain)

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/schemas/treaty\_amendment.v0.1.json",  "title": "Treaty Amendment v0.1",  "type": "object",  "additionalProperties": false,  "required": ["amend\_id", "ts", "proposed\_by", "diff", "prev\_hash", "this\_hash"],  "properties": {    "amend\_id": { "type": "string", "format": "uuid" },    "ts": { "type": "string", "format": "date-time" },    "proposed\_by": { "type": "string", "minLength": 3 },    "diff": {      "type": "object",      "additionalProperties": false,      "required": ["format", "patch"],      "properties": {        "format": { "type": "string", "enum": ["json\_patch"] },        "patch": {          "type": "array",          "minItems": 1,          "items": {            "type": "object",            "additionalProperties": false,            "required": ["op", "path"],            "properties": {              "op": { "type": "string", "enum": ["add", "remove", "replace", "move", "copy", "test"] },              "path": { "type": "string", "minLength": 1 },              "from": { "type": "string" },              "value": {}            }          }        }      }    },    "prev\_hash": { "$ref": "https://treatynet.dev/schemas/hash.v0.1.json" },    "this\_hash": { "$ref": "https://treatynet.dev/schemas/hash.v0.1.json" }  }}
\`\`\`

3) Trust Event Schema

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/schemas/trust\_event.v0.1.json",  "title": "Trust Event v0.1",  "type": "object",  "additionalProperties": false,  "required": ["event\_id", "ts", "issuer", "subject", "event\_type", "severity", "evidence\_hash"],  "properties": {    "event\_id": { "type": "string", "format": "uuid" },    "ts": { "type": "string", "format": "date-time" },    "issuer": { "type": "string", "minLength": 3 },    "subject": { "type": "string", "minLength": 3 },    "event\_type": {      "type": "string",      "enum": [        "missed\_proof",        "late\_payment",        "default",        "fraud",        "policy\_breach",        "excellent\_behavior",        "module\_breach"      ]    },    "severity": { "type": "number", "minimum": 0, "maximum": 1 },    "evidence\_hash": { "$ref": "https://treatynet.dev/schemas/hash.v0.1.json" },    "treaty\_id": { "type": "string" },    "module": { "type": "string" },    "notes": { "type": "string", "maxLength": 2000 }  }}
\`\`\`

4) Sanctions State Machine (Federation-Level)
4.1 Sanction State Schema

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/schemas/sanction\_state.v0.1.json",  "title": "Sanction State v0.1",  "type": "object",  "additionalProperties": false,  "required": ["member\_id", "level", "since\_ts", "reasons", "active\_actions"],  "properties": {    "member\_id": { "type": "string", "minLength": 3 },    "level": { "type": "integer", "minimum": 0, "maximum": 4 },    "since\_ts": { "type": "string", "format": "date-time" },    "reasons": {      "type": "array",      "minItems": 1,      "items": { "$ref": "https://treatynet.dev/schemas/trust\_event.v0.1.json" }    },    "active\_actions": {      "type": "array",      "items": {        "type": "string",        "enum": [          "reduce\_limits\_25",          "reduce\_limits\_50",          "freeze\_new\_draws",          "increase\_haircut\_5",          "increase\_haircut\_15",          "suspend\_lp\_draws",          "suspend\_crp\_draws",          "terminate\_high\_risk\_modules",          "publish\_fed\_alert",          "expelled"        ]      },      "uniqueItems": true    }  }}
\`\`\`

4.2 Sanctions FSM (machine-readable)

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/state\_machines/sanctions\_fsm.v0.1.json",  "title": "Sanctions FSM v0.1",  "type": "object",  "additionalProperties": false,  "required": ["states", "initial\_state", "transitions"],  "properties": {    "initial\_state": { "type": "string", "const": "L0" },    "states": {      "type": "array",      "items": { "type": "string", "enum": ["L0", "L1", "L2", "L3", "L4"] },      "minItems": 5,      "uniqueItems": true    },    "transitions": {      "type": "array",      "minItems": 1,      "items": {        "type": "object",        "additionalProperties": false,        "required": ["from", "to", "on", "guard", "actions"],        "properties": {          "from": { "type": "string", "enum": ["L0", "L1", "L2", "L3", "L4"] },          "to": { "type": "string", "enum": ["L0", "L1", "L2", "L3", "L4"] },          "on": {            "type": "string",            "enum": [              "evt.missed\_proof",              "evt.late\_payment",              "evt.default",              "evt.fraud",              "evt.policy\_breach",              "evt.clear\_window\_passed"            ]          },          "guard": { "type": "string", "minLength": 1, "maxLength": 2000 },          "actions": {            "type": "array",            "items": { "type": "string", "minLength": 1, "maxLength": 128 }          }        }      }    }  },  "example": {    "initial\_state": "L0",    "states": ["L0", "L1", "L2", "L3", "L4"],    "transitions": [      {        "from": "L0",        "to": "L1",        "on": "evt.missed\_proof",        "guard": "late\_hours <= 24 OR late\_payment\_rate\_30d > 0.02",        "actions": ["reduce\_limits\_25", "increase\_haircut\_5", "increase\_proof\_cadence\_14d"]      },      {        "from": "L1",        "to": "L2",        "on": "evt.missed\_proof",        "guard": "count\_missed\_proof\_30d >= 2 OR default\_severity >= 0.4",        "actions": ["freeze\_new\_draws", "reduce\_limits\_50", "increase\_haircut\_15", "reset\_probation"]      },      {        "from": "L0",        "to": "L3",        "on": "evt.fraud",        "guard": "severity >= 0.7",        "actions": ["suspend\_lp\_draws", "suspend\_crp\_draws", "terminate\_high\_risk\_modules", "publish\_fed\_alert"]      },      {        "from": "L3",        "to": "L4",        "on": "evt.fraud",        "guard": "severity >= 0.7 AND count\_L3\_events\_12m >= 2",        "actions": ["expelled", "publish\_fed\_alert"]      },      {        "from": "L1",        "to": "L0",        "on": "evt.clear\_window\_passed",        "guard": "no\_events\_severity\_ge\_0.4\_for\_days >= 30 AND proofs\_on\_time\_for\_days >= 30",        "actions": ["restore\_limits\_baseline"]      }    ]  }}
\`\`\`

5) Dispute Schema + Dispute FSM
5.1 Dispute Object Schema

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/schemas/dispute.v0.1.json",  "title": "Dispute v0.1",  "type": "object",  "additionalProperties": false,  "required": ["dispute\_id", "treaty\_id", "opened\_ts", "opened\_by", "claim\_type", "status", "evidence", "requested\_remedy"],  "properties": {    "dispute\_id": { "type": "string", "format": "uuid" },    "treaty\_id": { "type": "string", "minLength": 3 },    "opened\_ts": { "type": "string", "format": "date-time" },    "opened\_by": { "type": "string", "minLength": 3 },    "respondent": { "type": "string", "minLength": 3 },    "claim\_type": {      "type": "string",      "enum": ["non\_delivery", "fraud", "metric\_manipulation", "breach", "late\_payment", "proof\_failure"]    },    "status": {      "type": "string",      "enum": ["open", "awaiting\_response", "in\_review", "ruled", "appeal\_open", "closed"]    },    "evidence": {      "type": "array",      "minItems": 1,      "items": { "$ref": "https://treatynet.dev/schemas/evidence\_ref.v0.1.json" }    },    "requested\_remedy": {      "type": "string",      "enum": ["penalty", "refund", "terminate", "repair", "collateral\_seize", "module\_suspend"]    },    "response": {      "type": "object",      "additionalProperties": false,      "properties": {        "responded\_ts": { "type": "string", "format": "date-time" },        "position": { "type": "string", "maxLength": 10000 },        "evidence": {          "type": "array",          "items": { "$ref": "https://treatynet.dev/schemas/evidence\_ref.v0.1.json" }        }      }    },    "ruling": {      "type": "object",      "additionalProperties": false,      "properties": {        "ruled\_ts": { "type": "string", "format": "date-time" },        "mode": { "type": "string", "enum": ["deterministic", "panel\_agents", "human\_arbiter"] },        "decision": { "type": "string", "enum": ["claim\_upheld", "claim\_denied", "partial"] },        "remedies": {          "type": "array",          "minItems": 1,          "items": { "type": "string", "minLength": 1, "maxLength": 256 }        },        "evidence\_hash": { "$ref": "https://treatynet.dev/schemas/hash.v0.1.json" }      }    }  }}
\`\`\`

5.2 Dispute FSM

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/state\_machines/dispute\_fsm.v0.1.json",  "title": "Dispute FSM v0.1",  "type": "object",  "additionalProperties": false,  "required": ["states", "initial\_state", "transitions", "timeouts"],  "properties": {    "initial\_state": { "type": "string", "const": "open" },    "states": {      "type": "array",      "items": { "type": "string", "enum": ["open", "awaiting\_response", "in\_review", "ruled", "appeal\_open", "closed"] },      "minItems": 6,      "uniqueItems": true    },    "timeouts": {      "type": "object",      "additionalProperties": false,      "required": ["response\_hours", "review\_days", "appeal\_days"],      "properties": {        "response\_hours": { "type": "integer", "minimum": 1, "maximum": 240 },        "review\_days": { "type": "integer", "minimum": 1, "maximum": 60 },        "appeal\_days": { "type": "integer", "minimum": 1, "maximum": 30 }      }    },    "transitions": {      "type": "array",      "items": {        "type": "object",        "additionalProperties": false,        "required": ["from", "to", "on", "guard", "actions"],        "properties": {          "from": { "type": "string" },          "to": { "type": "string" },          "on": {            "type": "string",            "enum": [              "dispute.opened",              "dispute.notified",              "dispute.response\_received",              "timeout.response",              "dispute.review\_started",              "timeout.review",              "dispute.ruled",              "dispute.appealed",              "timeout.appeal",              "dispute.closed"            ]          },          "guard": { "type": "string", "minLength": 1 },          "actions": {            "type": "array",            "items": { "type": "string", "minLength": 1, "maxLength": 128 }          }        }      }    }  }}
\`\`\`

6) Pool Draw Schema + Pool Draw FSM (Liquidity Pool)
6.1 LP Draw Request Schema

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/schemas/lp\_draw\_request.v0.1.json",  "title": "Liquidity Pool Draw Request v0.1",  "type": "object",  "additionalProperties": false,  "required": [    "draw\_id",    "fed\_id",    "member\_id",    "requested\_ts",    "amount",    "currency",    "reason\_code",    "collateral\_offer",    "solvency\_proof\_ref"  ],  "properties": {    "draw\_id": { "type": "string", "format": "uuid" },    "fed\_id": { "type": "string", "pattern": "^fed:[a-z0-9\\\\-\_.]+$" },    "member\_id": { "type": "string", "minLength": 3 },    "requested\_ts": { "type": "string", "format": "date-time" },    "amount": { "type": "number", "exclusiveMinimum": 0 },    "currency": { "type": "string", "minLength": 3, "maxLength": 10 },    "reason\_code": {      "type": "string",      "enum": ["liquidity\_freeze", "processor\_hold", "settlement\_gap", "crisis\_drill"]    },    "collateral\_offer": {      "type": "object",      "additionalProperties": false,      "required": ["type", "notional", "haircut", "evidence"],      "properties": {        "type": { "type": "string", "enum": ["cash\_eq", "treasury\_proxy", "receivables"] },        "notional": { "type": "number", "exclusiveMinimum": 0 },        "haircut": { "type": "number", "minimum": 0, "maximum": 0.95 },        "evidence": {          "type": "array",          "minItems": 1,          "items": { "$ref": "https://treatynet.dev/schemas/evidence\_ref.v0.1.json" }        }      }    },    "solvency\_proof\_ref": { "$ref": "https://treatynet.dev/schemas/evidence\_ref.v0.1.json" }  }}
\`\`\`

6.2 LP Draw FSM

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/state\_machines/lp\_draw\_fsm.v0.1.json",  "title": "Liquidity Pool Draw FSM v0.1",  "type": "object",  "additionalProperties": false,  "required": ["states", "initial\_state", "transitions"],  "properties": {    "initial\_state": { "type": "string", "const": "requested" },    "states": {      "type": "array",      "items": { "type": "string", "enum": ["requested", "verifying", "collateral\_pending", "approved", "funded", "repaying", "closed", "denied", "defaulted"] },      "uniqueItems": true    },    "transitions": {      "type": "array",      "items": {        "type": "object",        "additionalProperties": false,        "required": ["from", "to", "on", "guard", "actions"],        "properties": {          "from": { "type": "string" },          "to": { "type": "string" },          "on": {            "type": "string",            "enum": [              "draw.submitted",              "draw.verify\_start",              "draw.verify\_ok",              "draw.verify\_fail",              "collateral.posted",              "collateral.fail",              "draw.approve",              "draw.fund",              "draw.repay\_start",              "draw.repay\_complete",              "timeout.repay",              "draw.close"            ]          },          "guard": { "type": "string", "minLength": 1 },          "actions": {            "type": "array",            "items": { "type": "string", "minLength": 1, "maxLength": 128 }          }        }      }    }  }}
\`\`\`

7) Compute Redeem Schema + FSM (Compute Reserve Pool)
7.1 CRP Redeem Request Schema

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/schemas/crp\_redeem\_request.v0.1.json",  "title": "Compute Reserve Redeem Request v0.1",  "type": "object",  "additionalProperties": false,  "required": ["redeem\_id", "fed\_id", "member\_id", "requested\_ts", "gpu\_class", "hours", "reason\_code"],  "properties": {    "redeem\_id": { "type": "string", "format": "uuid" },    "fed\_id": { "type": "string", "pattern": "^fed:[a-z0-9\\\\-\_.]+$" },    "member\_id": { "type": "string", "minLength": 3 },    "requested\_ts": { "type": "string", "format": "date-time" },    "gpu\_class": { "type": "string", "minLength": 2, "maxLength": 64 },    "hours": { "type": "number", "exclusiveMinimum": 0 },    "reason\_code": { "type": "string", "enum": ["provider\_outage", "cost\_spike", "crisis\_drill"] }  }}
\`\`\`

7.2 CRP Redeem FSM

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/state\_machines/crp\_redeem\_fsm.v0.1.json",  "title": "CRP Redeem FSM v0.1",  "type": "object",  "additionalProperties": false,  "required": ["states", "initial\_state", "transitions"],  "properties": {    "initial\_state": { "type": "string", "const": "requested" },    "states": {      "type": "array",      "items": { "type": "string", "enum": ["requested", "verifying", "approved", "tokens\_issued", "consumed", "closed", "denied"] },      "uniqueItems": true    },    "transitions": {      "type": "array",      "items": {        "type": "object",        "additionalProperties": false,        "required": ["from", "to", "on", "guard", "actions"],        "properties": {          "from": { "type": "string" },          "to": { "type": "string" },          "on": {            "type": "string",            "enum": [              "redeem.submitted",              "redeem.verify\_start",              "redeem.verify\_ok",              "redeem.verify\_fail",              "redeem.approve",              "redeem.issue\_tokens",              "redeem.consume",              "redeem.close"            ]          },          "guard": { "type": "string", "minLength": 1 },          "actions": {            "type": "array",            "items": { "type": "string", "minLength": 1, "maxLength": 128 }          }        }      }    }  }}
\`\`\`

8) Membership FSM (Admission, Probation, Promotion, Expulsion)
8.1 Membership Record Schema

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/schemas/membership\_record.v0.1.json",  "title": "Federation Membership Record v0.1",  "type": "object",  "additionalProperties": false,  "required": ["fed\_id", "member\_id", "tier", "status", "since\_ts", "policy\_hashes"],  "properties": {    "fed\_id": { "type": "string", "pattern": "^fed:[a-z0-9\\\\-\_.]+$" },    "member\_id": { "type": "string", "minLength": 3 },    "tier": { "type": "string", "enum": ["P", "M", "C"] },    "status": { "type": "string", "enum": ["applied", "probation", "active", "suspended", "expelled", "withdrawn"] },    "since\_ts": { "type": "string", "format": "date-time" },    "policy\_hashes": {      "type": "object",      "additionalProperties": false,      "required": ["constitution\_hash", "restricted\_industries\_hash"],      "properties": {        "constitution\_hash": { "$ref": "https://treatynet.dev/schemas/hash.v0.1.json" },        "restricted\_industries\_hash": { "$ref": "https://treatynet.dev/schemas/hash.v0.1.json" }      }    }  }}
\`\`\`

8.2 Membership FSM

\`\`\`
JSON{  "$schema": "https://json-schema.org/draft/2020-12/schema",  "$id": "https://treatynet.dev/state\_machines/membership\_fsm.v0.1.json",  "title": "Membership FSM v0.1",  "type": "object",  "additionalProperties": false,  "required": ["states", "initial\_state", "transitions"],  "properties": {    "initial\_state": { "type": "string", "const": "applied" },    "states": {      "type": "array",      "items": { "type": "string", "enum": ["applied", "probation", "active", "suspended", "expelled", "withdrawn"] },      "uniqueItems": true    },    "transitions": {      "type": "array",      "items": {        "type": "object",        "additionalProperties": false,        "required": ["from", "to", "on", "guard", "actions"],        "properties": {          "from": { "type": "string" },          "to": { "type": "string" },          "on": {            "type": "string",            "enum": [              "join.apply",              "join.accept\_probation",              "join.promote\_active",              "member.suspend",              "member.reinstate",              "member.expel",              "member.withdraw"            ]          },          "guard": { "type": "string", "minLength": 1 },          "actions": {            "type": "array",            "items": { "type": "string", "minLength": 1, "maxLength": 128 }          }        }      }    }  }}
\`\`\`

9) Notes on Guards and Actions
The state machines above intentionally store guard as a string. In implementation, compile guards into deterministic predicates, for example:

late\_hours <= 24

count\_missed\_proof\_30d >= 2

sanction\_level < 3

has\_valid\_solvency\_proof == true

draw\_amount <= tier\_limit

Actions map to concrete service calls, e.g.:

reduce\_limits\_25 → Policy Engine updates treaty caps

freeze\_new\_draws → Settlement Service blocks draw endpoints

publish\_fed\_alert → Trust Graph publishes federation event

issue\_tokens → Compute scheduler mints signed job tokens

If you want the next increment, I’ll produce the full JSON Schema pack for each module’s terms (liquidity\_backstop, outcome\_swap, compute\_exchange, attention\_exchange, manufacturing\_throughput, logistics\_throughput, regulatory\_capacity) with strict field masks and validation rules.

---

