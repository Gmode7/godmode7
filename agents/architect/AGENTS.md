# Architect Agent - AGENTS.md

## Sub-Agent Definitions

### 📈 Scalability Analyst
**ID:** `arch-scalability-analyst`  
**Purpose:** Model load and growth patterns  
**Spawn Condition:** System has scaling requirements

**Capabilities:**
- Load modeling
- Bottleneck prediction
- Scaling strategy design
- Capacity planning

**Input:** Expected load, growth projections  
**Output:** Scalability assessment  
**Max Runtime:** 8 minutes

---

### 🔐 Security Architect
**ID:** `arch-security-architect`  
**Purpose:** Deep security review  
**Spawn Condition:** High-security requirements or sensitive data

**Capabilities:**
- Threat modeling (STRIDE)
- Security control design
- Authentication/Authorization architecture
- Data protection strategy

**Input:** Architecture, threat landscape  
**Output:** Security architecture review  
**Max Runtime:** 10 minutes

---

### ⚡ Performance Engineer
**ID:** `arch-performance-engineer`  
**Purpose:** Performance optimization strategy  
**Spawn Condition:** Strict latency/throughput requirements

**Capabilities:**
- Latency analysis
- Throughput modeling
- Caching strategy
- Database optimization

**Input:** Performance requirements, access patterns  
**Output:** Performance architecture  
**Max Runtime:** 8 minutes

---

### 🔌 Integration Specialist
**ID:** `arch-integration-specialist`  
**Purpose:** Complex integration design  
**Spawn Condition:** Multiple external integrations

**Capabilities:**
- Integration pattern selection
- API gateway design
- Event choreography
- Legacy system adaptation

**Input:** Integration requirements  
**Output:** Integration architecture  
**Max Runtime:** 7 minutes

---

## Sub-Agent Spawn Rules

### Max Concurrent: 2
### Max Depth: 1

### Common Combinations:
- Scalability + Performance ✓ (for high-load systems)
- Security + Integration ✓ (for external-facing APIs)
- Performance only ✓ (for latency-sensitive systems)

### Spawn Triggers

```yaml
spawn_scalability_analyst:
  condition: expected_load > 1000_rps OR growth_rate > 2x/year
  priority: high

spawn_security_architect:
  condition: pii_involved OR financial_data OR public_api
  priority: high

spawn_performance_engineer:
  condition: latency_sla < 100ms OR throughput > 1000_rps
  priority: medium

spawn_integration_specialist:
  condition: external_integrations > 3
  priority: medium
```

---

## Heavy Load Scenario

For a high-scale public API:

1. **Spawn:** `scalability-analyst` + `performance-engineer`
2. **Collect:** Scaling patterns + latency analysis
3. **Spawn:** `security-architect` (security-critical)
4. **Integrate:** All findings into architecture
5. **Document:** ADRs for key scaling decisions

---

## Enterprise Scenario

For enterprise integration:

1. **Spawn:** `integration-specialist` + `security-architect`
2. **Collect:** Integration patterns + security controls
3. **Spawn:** `scalability-analyst` (if needed)
4. **Integrate:** Enterprise-grade architecture
5. **Document:** Security and integration ADRs
