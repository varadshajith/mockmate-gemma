# T4 Real-Voice Fixture Script

Record only every **Current** sentence. Do not record Prior sentences.

- Run: `pw-record --rate 16000 --channels 1 --format s16 <filename>`
- Speak at normal pace in quiet room. Record one sentence per file.
- Keep each clip under 15 seconds.
- Verify: `soxi <filename>` → expect 16000 Hz, 1 channel, s16.

### C1 (contradicting)

Prior (text, not recorded): We confirm every order only after synchronous replica writes succeed.
Current (RECORD THIS): We accept asynchronous replica writes before confirming the order.
Expected: contradicts = true
Filename: testing/fixtures/t4/C1.wav

### C2 (contradicting)

Prior (text, not recorded): Product cache entries expire after five minutes.
Current (RECORD THIS): This cache never expires; invalidation happens only during deployments.
Expected: contradicts = true
Filename: testing/fixtures/t4/C2.wav

### C3 (contradicting)

Prior (text, not recorded): All writes go through one primary database node.
Current (RECORD THIS): Any regional leader can accept writes for this database.
Expected: contradicts = true
Filename: testing/fixtures/t4/C3.wav

### C4 (contradicting)

Prior (text, not recorded): Payment transactions use serializable isolation.
Current (RECORD THIS): Payment transactions run at read committed isolation only.
Expected: contradicts = true
Filename: testing/fixtures/t4/C4.wav

### C5 (contradicting)

Prior (text, not recorded): We deploy with blue-green releases and instant rollback.
Current (RECORD THIS): We use rolling deployments and cannot instantly roll back.
Expected: contradicts = true
Filename: testing/fixtures/t4/C5.wav

### C6 (contradicting)

Prior (text, not recorded): Our application is a single deployable monolith.
Current (RECORD THIS): Our application now consists of independently deployed microservices.
Expected: contradicts = true
Filename: testing/fixtures/t4/C6.wav

### C7 (contradicting)

Prior (text, not recorded): Every session token is stored and checked server-side.
Current (RECORD THIS): Session tokens are fully stateless and never stored server-side.
Expected: contradicts = true
Filename: testing/fixtures/t4/C7.wav

### C8 (contradicting)

Prior (text, not recorded): Event history is our immutable source of truth.
Current (RECORD THIS): Mutable account rows are our only source of truth.
Expected: contradicts = true
Filename: testing/fixtures/t4/C8.wav

### C9 (contradicting)

Prior (text, not recorded): Production releases require manual approval from an operator.
Current (RECORD THIS): Every merged commit deploys automatically without human approval.
Expected: contradicts = true
Filename: testing/fixtures/t4/C9.wav

### C10 (contradicting)

Prior (text, not recorded): Catalog updates write through cache before reaching the database.
Current (RECORD THIS): Catalog updates write directly to database without touching cache.
Expected: contradicts = true
Filename: testing/fixtures/t4/C10.wav

### N1 (non-contradicting)

Prior (text, not recorded): Our availability target is 99.99 percent each month.
Current (RECORD THIS): That target means four nines of availability for this service.
Expected: contradicts = false
Filename: testing/fixtures/t4/N1.wav

### N2 (non-contradicting)

Prior (text, not recorded): We read hot product data from memory cache first.
Current (RECORD THIS): The cache serves hot reads before requests reach PostgreSQL.
Expected: contradicts = false
Filename: testing/fixtures/t4/N2.wav

### N3 (non-contradicting)

Prior (text, not recorded): A single primary database node handles all writes.
Current (RECORD THIS): Replicas handle read traffic while primary remains write authority.
Expected: contradicts = false
Filename: testing/fixtures/t4/N3.wav

### N4 (non-contradicting)

Prior (text, not recorded): Ledger changes occur inside one atomic transaction.
Current (RECORD THIS): Either every ledger update commits, or none becomes visible.
Expected: contradicts = false
Filename: testing/fixtures/t4/N4.wav

### N5 (non-contradicting)

Prior (text, not recorded): Blue-green deployment keeps the previous release ready.
Current (RECORD THIS): We can switch traffic back to old version immediately.
Expected: contradicts = false
Filename: testing/fixtures/t4/N5.wav

### N6 (non-contradicting)

Prior (text, not recorded): Billing reacts to order events published through Kafka.
Current (RECORD THIS): Kafka events let billing react without direct service calls.
Expected: contradicts = false
Filename: testing/fixtures/t4/N6.wav

### N7 (non-contradicting)

Prior (text, not recorded): Database migrations remain compatible with the previous application version.
Current (RECORD THIS): Old application instances can still use the migrated schema.
Expected: contradicts = false
Filename: testing/fixtures/t4/N7.wav

### N8 (non-contradicting)

Prior (text, not recorded): Cached recommendations have a five-minute time to live.
Current (RECORD THIS): Items expire after five minutes unless explicit invalidation removes them.
Expected: contradicts = false
Filename: testing/fixtures/t4/N8.wav

### N9 (non-contradicting)

Prior (text, not recorded): Read replicas receive writes asynchronously from the primary.
Current (RECORD THIS): Because replication is asynchronous, replicas can briefly return older data.
Expected: contradicts = false
Filename: testing/fixtures/t4/N9.wav

### N10 (non-contradicting)

Prior (text, not recorded): Kubernetes maintains three application replicas during normal operation.
Current (RECORD THIS): We keep three pods running to tolerate one failure.
Expected: contradicts = false
Filename: testing/fixtures/t4/N10.wav
