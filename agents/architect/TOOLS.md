# Architect Agent - TOOLS.md

## Available Capabilities

### 1. Architecture Design
**Purpose:** System-level design and component modeling  
**Trigger:** After PRD review  
**Output:** `architecture` artifact

**Covers:**
- Component decomposition
- Service boundaries
- Data flow diagrams
- Interface definitions
- Deployment topology

---

### 2. ADR Creation
**Purpose:** Document architectural decisions  
**Trigger:** For each significant decision  
**Output:** `adr` artifact(s)

**Format:**
```markdown
# ADR-XXX: [Title]

## Status
Proposed / Accepted / Deprecated

## Context
What is the issue we're deciding?

## Decision
What are we doing?

## Consequences
### Positive
...
### Negative
...

## Alternatives Considered
...
```

---

### 3. API Design
**Purpose:** Define service interfaces  
**Trigger:** When service boundaries involve APIs  
**Output:** API specifications

**Includes:**
- REST/GraphQL/gRPC design
- Request/response schemas
- Error handling
- Rate limiting
- Versioning strategy

---

### 4. Data Modeling
**Purpose:** Database and storage design  
**Trigger:** When persistence is needed  
**Output:** Data model specifications

**Covers:**
- Entity relationships
- Schema design
- Access patterns
- Migration strategies
- Caching strategy

---

### 5. Integration Design
**Purpose:** Define how systems connect  
**Trigger:** Multiple services/components  
**Output:** Integration specifications

**Patterns:**
- Synchronous vs Asynchronous
- Event-driven vs Request-response
- Message queue design
- Saga patterns
- Circuit breakers

---

### 6. Non-Functional Requirements
**Purpose:** Define quality attributes  
**Trigger:** Always  
**Output:** NFR specifications in architecture

**Categories:**
- Performance (latency, throughput)
- Reliability (availability, durability)
- Scalability (horizontal, vertical)
- Security (authentication, authorization)
- Observability (metrics, logs, traces)

---

## Available Sub-Agents

### scalability-analyst
Models load patterns and scaling strategies. Can simulate growth scenarios.

### security-architect
Deep security review of architecture. Threat modeling specialist.

### performance-engineer
Latency and throughput analysis. Bottleneck identification.

### integration-specialist
Complex integration patterns. Legacy system integration.

---

## Output Artifacts

| Artifact | Type | Purpose |
|----------|------|---------|
| `architecture` | Document | System design |
| `adr` | Document | Decision records |
| `api_specs` | OpenAPI/Proto | Interface contracts |
| `data_model` | ERD/Schema | Storage design |
