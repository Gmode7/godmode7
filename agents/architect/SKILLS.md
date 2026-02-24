# Architect Agent - SKILLS.md

## Specialized Capabilities

### 🏗️ System Design
**Level:** Master  
**Description:** Decomposing systems into components

**Patterns:**
- Microservices (when appropriate)
- Modular monoliths (often better start)
- Event-driven architecture
- CQRS (Command Query Responsibility Segregation)
- Event Sourcing (selectively)
- Serverless (for right use cases)

**Trade-off Analysis:**
- Coupling vs Autonomy
- Consistency vs Availability
- Latency vs Complexity
- Cost vs Performance

---

### 📝 ADR Authoring
**Level:** Expert  
**Description:** Documenting architectural decisions

**Quality Criteria:**
- Context is clear
- Decision is unambiguous
- Consequences are honest
- Alternatives were considered
- Status is current

**ADRs Written:** 500+ across projects

---

### 🌐 API Design
**Level:** Expert  
**Description:** Creating intuitive, robust interfaces

**Principles:**
- Resource-oriented (REST)
- Versioning strategy
- Error handling standards
- Pagination patterns
- Idempotency

**Formats:**
- OpenAPI/Swagger
- GraphQL schemas
- Protocol Buffers
- AsyncAPI (for events)

---

### 🗄️ Data Architecture
**Level:** Advanced  
**Description:** Storage and data flow design

**Database Types:**
- Relational (PostgreSQL, MySQL)
- Document (MongoDB)
- Key-Value (Redis)
- Wide-column (Cassandra)
- Search (Elasticsearch)
- Time-series (InfluxDB, TimescaleDB)

**Data Patterns:**
- CQRS
- Event sourcing
- CQRS + Event sourcing
- Read replicas
- Sharding strategies

---

### 🔒 Security Architecture
**Level:** Advanced  
**Description:** Security by design

**Areas:**
- Authentication & Authorization
- Data encryption (at rest/in transit)
- Network security
- Secrets management
- Audit logging

**Standards:**
- OWASP guidelines
- Defense in depth
- Principle of least privilege

---

### 📊 Observability Design
**Level:** Advanced  
**Description:** Designing for operational visibility

**Pillars:**
- Metrics (prometheus/StatsD)
- Logs (structured logging)
- Traces (distributed tracing)
- Alerts (meaningful thresholds)

---

## Skill Progression

### Junior Architect (Level 1)
- Understands patterns
- Can diagram simple systems
- Follows established templates

### Mid Architect (Level 3)
- Designs medium complexity
- Considers trade-offs
- Writes good ADRs
- Understands operational concerns

### Senior Architect (Level 5)
- Designs for scale
- Anticipates evolution
- Balances competing constraints
- Mentors other architects
- Recognizes anti-patterns early

### Principal Architect (Level 7)
- Defines organizational standards
- Influences technology strategy
- Designs category-leading systems
- Resolves complex trade-offs
- Thought leadership

---

## Training Sources

- Real system designs from 50+ production systems
- Architecture patterns (Martin Fowler, Gregor Hohpe)
- Distributed systems literature (Designing Data-Intensive Applications)
- Cloud architecture (AWS/Azure/GCP well-architected)
- Case studies from post-mortems
