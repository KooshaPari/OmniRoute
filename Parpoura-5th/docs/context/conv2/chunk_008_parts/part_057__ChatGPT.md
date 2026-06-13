### **ChatGPT**

Here are the canonical example JSON instances (valid against the schemas you now have) for each module, followed by a combined treaty template that wires multiple modules together in a realistic way.
I’m using plausible numbers; treat them as defaults you’ll tune per federation tier (P/M/C).

1) Canonical module terms examples
1.1 Liquidity Backstop (liquidity\_backstop)

\`\`\`
JSON{  "module": "liquidity\_backstop",  "terms": {    "credit\_line\_limit": 5000000,    "draw\_window\_days": 30,    "max\_draws\_per\_window": 2,    "interest\_apr": 0.12,    "collateral\_types": ["cash\_eq", "treasury\_proxy", "receivables"],    "collateral\_haircuts": {      "cash\_eq": 0.05,      "treasury\_proxy": 0.15,      "stablecash": 0.10,      "receivables": 0.45,      "other": 0.70    },    "min\_collateralization\_ratio": 1.25,    "auto\_freeze\_triggers": {      "proof\_missed": true,      "sanction\_level\_ge": 2,      "trust\_drop\_ge": 0.15    },    "repay\_terms": {      "max\_duration\_days": 90,      "early\_repay\_allowed": true,      "default\_grace\_days": 5,      "default\_penalty\_apr": 0.35    }  }}
\`\`\`

1.2 Outcome Swap (outcome\_swap)

\`\`\`
JSON{  "module": "outcome\_swap",  "terms": {    "allowed\_instrument\_types": ["revenue\_share", "milestone\_bounty", "internal\_bond"],    "instrument\_requirements": {      "max\_duration\_days": 540,      "max\_cap\_multiple": 3.0,      "min\_seniority": "senior\_to\_equity"    },    "swap\_limits": {      "max\_notional\_per\_swap": 1000000,      "max\_open\_swaps": 50,      "netting\_allowed": true    },    "payout\_attestation": {      "required\_sources": ["processor\_attestation", "bank\_attestation"],      "cadence\_days": 30,      "refund\_rate\_max": 0.08    },    "anti\_manipulation": {      "revenue\_smoothing\_window\_days": 30,      "anomaly\_trigger\_z": 4.0,      "penalties": ["haircut\_increase", "module\_freeze", "trust\_event\_publish", "terminate"]    }  }}
\`\`\`

1.3 Compute Exchange (compute\_exchange)

\`\`\`
JSON{  "module": "compute\_exchange",  "terms": {    "allowed\_gpu\_classes": ["A100", "H100", "L40S"],    "token\_delivery": {      "token\_ttl\_seconds": 3600,      "token\_scope": ["submit\_job", "read\_logs", "cancel\_job", "list\_queues"],      "revocation\_supported": true    },    "sla": {      "uptime": 0.99,      "max\_queue\_ms": 60000,      "regions": ["us-west", "us-east", "eu-west"]    },    "rate\_limits": {      "jobs\_per\_min": 120,      "concurrent\_jobs\_max": 50,      "bandwidth\_mbps\_max": 2000    },    "settlement": {      "pricing\_model": "per\_gpu\_hour",      "currency": "USD",      "prepay\_required": true,      "late\_payment\_penalty": 0.15    },    "abuse\_controls": {      "job\_sandbox\_required": true,      "egress\_allowlist\_required": true,      "violation\_actions": ["throttle", "revoke\_tokens", "module\_freeze", "trust\_event\_publish", "terminate"]    }  }}
\`\`\`

1.4 Attention Exchange (attention\_exchange)

\`\`\`
JSON{  "module": "attention\_exchange",  "terms": {    "surfaces": [      { "surface\_type": "discord", "surface\_id": "server:12345#announcements" },      { "surface\_type": "reddit", "surface\_id": "subreddit:rExample" }    ],    "quotas": {      "posts\_per\_week": 5,      "links\_per\_week": 3,      "min\_value\_first\_ratio": 0.8    },    "content\_rules": {      "no\_deceptive\_claims": true,      "no\_impersonation": true,      "community\_rules\_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",      "disclosure\_required": true    },    "audit": {      "random\_audit\_rate": 0.2,      "log\_retention\_days": 365    },    "penalties": ["quota\_reduce", "module\_freeze", "trust\_event\_publish", "terminate"]  }}
\`\`\`

1.5 Manufacturing Throughput (manufacturing\_throughput)

\`\`\`
JSON{  "module": "manufacturing\_throughput",  "terms": {    "process\_types": ["cnc", "assembly"],    "capacity\_units": {      "unit": "units",      "max\_per\_month": 20000,      "min\_order\_qty": 500    },    "sla": {      "lead\_time\_days\_max": 45,      "on\_time\_delivery\_target": 0.95,      "regions": ["cn-south", "us-west"]    },    "quality": {      "aql\_max": 1.5,      "defect\_rate\_max": 0.02,      "tolerance\_policy": {        "units": "mm",        "max\_deviation": 0.2      }    },    "inspection": {      "required": true,      "providers": ["inspector:SGS", "inspector:Intertek"],      "sampling\_plan": { "method": "aql\_standard", "sample\_size": 125 },      "evidence\_required": ["photo", "video", "dimension\_report", "batch\_serials", "inspector\_attestation"]    },    "settlement": {      "escrow\_required": true,      "currency": "USD",      "milestones": [        { "name": "materials\_received", "pct\_release": 0.2, "evidence\_gate": ["materials\_received"] },        { "name": "first\_article", "pct\_release": 0.2, "evidence\_gate": ["first\_article\_approved"] },        { "name": "inspection", "pct\_release": 0.3, "evidence\_gate": ["inspection\_passed"] },        { "name": "shipment", "pct\_release": 0.3, "evidence\_gate": ["shipment\_scanned"] }      ]    },    "penalties": {      "late\_delivery\_fee\_pct": 0.05,      "defect\_fee\_pct": 0.10,      "remedy\_actions": ["rework", "replace", "refund", "collateral\_seize", "terminate", "trust\_event\_publish"]    }  }}
\`\`\`

1.6 Logistics Throughput (logistics\_throughput)

\`\`\`
JSON{  "module": "logistics\_throughput",  "terms": {    "lanes": [      { "from": "cn-south", "to": "us-west", "mode": "sea" },      { "from": "us-west", "to": "us-west", "mode": "parcel" }    ],    "capacity": {      "unit": "orders",      "max\_per\_week": 5000    },    "sla": {      "delivery\_days\_p95\_max": 7,      "loss\_rate\_max": 0.002,      "damage\_rate\_max": 0.004    },    "proofs": {      "scan\_events\_required": ["pickup\_scan", "in\_transit\_scan", "out\_for\_delivery", "delivered\_scan", "warehouse\_received"],      "carrier\_attestation\_required": false    },    "settlement": {      "currency": "USD",      "pricing\_model": "per\_order",      "escrow\_required": false    },    "penalties": {      "late\_fee\_pct": 0.02,      "loss\_fee\_pct": 1.0,      "damage\_fee\_pct": 0.5,      "remedy\_actions": ["refund", "replace", "insurance\_claim", "terminate", "trust\_event\_publish"]    }  }}
\`\`\`

1.7 Regulatory Capacity (regulatory\_capacity)

\`\`\`
JSON{  "module": "regulatory\_capacity",  "terms": {    "jurisdictions": ["US", "EU"],    "capacity\_units": {      "unit": "audit\_hours",      "max\_per\_month": 200    },    "allowed\_uses": ["policy\_templates", "audit\_support", "compliance\_review", "controls\_library"],    "prohibited\_uses": ["license\_laundering", "sanctions\_evasion", "identity\_obfuscation", "fraud\_cover", "illegal\_activity\_support"],    "proofs": {      "audit\_trail\_required": true,      "counsel\_attestation\_required": true,      "log\_retention\_days": 730    },    "settlement": {      "currency": "USD",      "pricing\_model": "retainer",      "escrow\_required": true    },    "penalties": {      "policy\_breach\_actions": ["module\_freeze", "terminate", "trust\_event\_publish", "federation\_alert"],      "severity\_threshold\_for\_suspension": 0.4    }  }}
\`\`\`

1.8 Dispute Resolution (dispute\_resolution)

\`\`\`
JSON{  "module": "dispute\_resolution",  "terms": {    "ladder": ["deterministic", "panel\_agents", "human\_arbiter"],    "timeouts": {      "response\_hours": 72,      "review\_days": 7,      "appeal\_days": 7    },    "allowed\_remedies": ["penalty", "refund", "terminate", "repair", "collateral\_seize", "module\_suspend"]  }}
\`\`\`

1.9 Solvency Proofs (solvency\_proofs)

\`\`\`
JSON{  "module": "solvency\_proofs",  "terms": {    "allowed\_proof\_types": ["custodian\_attestation", "merkle\_balances", "audited\_statement"],    "required\_type": "merkle\_balances",    "cadence\_days": 1,    "expiry\_days": 3,    "miss\_actions": ["freeze\_modules", "reduce\_limits", "publish\_trust\_event", "federation\_alert"]  }}
\`\`\`

2) Combined Treaty Template (multi-module)
This is a realistic “default bilateral treaty” between sovereign:A and sovereign:B under federation fed:fedone:v0.1.

\`\`\`
JSON{  "treaty\_id": "treaty:fedone-a-b-2026q1",  "version": "0.1",  "participants": ["sovereign:A", "sovereign:B"],  "state": "active",  "effective\_ts": "2026-03-01T00:00:00Z",  "expiry\_ts": "2027-03-01T00:00:00Z",  "caps": {    "max\_notional": 10000000,    "max\_draws\_per\_window": 2,    "window\_days": 30  },  "proof\_requirements": {    "solvency": "merkle\_balances",    "cadence\_days": 1,    "proof\_expiry\_days": 3  },  "modules": [    {      "module": "solvency\_proofs",      "terms": {        "allowed\_proof\_types": ["custodian\_attestation", "merkle\_balances", "audited\_statement"],        "required\_type": "merkle\_balances",        "cadence\_days": 1,        "expiry\_days": 3,        "miss\_actions": ["freeze\_modules", "reduce\_limits", "publish\_trust\_event", "federation\_alert"]      }    },    {      "module": "liquidity\_backstop",      "terms": {        "credit\_line\_limit": 5000000,        "draw\_window\_days": 30,        "max\_draws\_per\_window": 2,        "interest\_apr": 0.12,        "collateral\_types": ["cash\_eq", "treasury\_proxy", "receivables"],        "collateral\_haircuts": {          "cash\_eq": 0.05,          "treasury\_proxy": 0.15,          "stablecash": 0.10,          "receivables": 0.45,          "other": 0.70        },        "min\_collateralization\_ratio": 1.25,        "auto\_freeze\_triggers": {          "proof\_missed": true,          "sanction\_level\_ge": 2,          "trust\_drop\_ge": 0.15        },        "repay\_terms": {          "max\_duration\_days": 90,          "early\_repay\_allowed": true,          "default\_grace\_days": 5,          "default\_penalty\_apr": 0.35        }      }    },    {      "module": "compute\_exchange",      "terms": {        "allowed\_gpu\_classes": ["A100", "H100", "L40S"],        "token\_delivery": {          "token\_ttl\_seconds": 3600,          "token\_scope": ["submit\_job", "read\_logs", "cancel\_job", "list\_queues"],          "revocation\_supported": true        },        "sla": {          "uptime": 0.99,          "max\_queue\_ms": 60000,          "regions": ["us-west", "us-east", "eu-west"]        },        "rate\_limits": {          "jobs\_per\_min": 120,          "concurrent\_jobs\_max": 50,          "bandwidth\_mbps\_max": 2000        },        "settlement": {          "pricing\_model": "per\_gpu\_hour",          "currency": "USD",          "prepay\_required": true,          "late\_payment\_penalty": 0.15        },        "abuse\_controls": {          "job\_sandbox\_required": true,          "egress\_allowlist\_required": true,          "violation\_actions": ["throttle", "revoke\_tokens", "module\_freeze", "trust\_event\_publish", "terminate"]        }      }    },    {      "module": "outcome\_swap",      "terms": {        "allowed\_instrument\_types": ["revenue\_share", "milestone\_bounty", "internal\_bond"],        "instrument\_requirements": {          "max\_duration\_days": 540,          "max\_cap\_multiple": 3.0,          "min\_seniority": "senior\_to\_equity"        },        "swap\_limits": {          "max\_notional\_per\_swap": 1000000,          "max\_open\_swaps": 50,          "netting\_allowed": true        },        "payout\_attestation": {          "required\_sources": ["processor\_attestation", "bank\_attestation"],          "cadence\_days": 30,          "refund\_rate\_max": 0.08        },        "anti\_manipulation": {          "revenue\_smoothing\_window\_days": 30,          "anomaly\_trigger\_z": 4.0,          "penalties": ["haircut\_increase", "module\_freeze", "trust\_event\_publish", "terminate"]        }      }    },    {      "module": "dispute\_resolution",      "terms": {        "ladder": ["deterministic", "panel\_agents", "human\_arbiter"],        "timeouts": { "response\_hours": 72, "review\_days": 7, "appeal\_days": 7 },        "allowed\_remedies": ["penalty", "refund", "terminate", "repair", "collateral\_seize", "module\_suspend"]      }    }  ],  "amendment\_history": []}
\`\`\`

3) Bonus: Federation-ready “physical add-on” treaty (manufacturing + logistics)
If you want a second combined template that includes physical modules too, say “physical template” and I’ll output a complete multi-module treaty that includes:

manufacturing throughput + inspections + escrow milestones

logistics throughput + scan proofs + penalties

and regulatory capacity sharing for compliance throughput

---

