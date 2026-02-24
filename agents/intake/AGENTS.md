# Intake Agent - AGENTS.md

## Sub-Agent Definitions (Phase 2)

These are specialized sub-agents that Intake can spawn for complex scenarios.

---

### 🔍 Researcher Agent
**ID:** `intake-researcher`  
**Purpose:** Research domain/context for unfamiliar industries  
**Spawn Condition:** Client is in unfamiliar domain (healthcare, finance, etc.)

**Capabilities:**
- Industry standard research
- Competitor analysis
- Regulatory requirement lookup
- Technology landscape survey

**Input:** Domain/industry name  
**Output:** Research summary document  
**Max Runtime:** 5 minutes

---

### 🎯 Clarifier Agent
**ID:** `intake-clarifier`  
**Purpose:** Deep-dive into ambiguous requirements  
**Spawn Condition:** Single requirement needs >3 follow-up questions

**Capabilities:**
- Break down complex features
- Ask targeted follow-ups
- Create user story scenarios
- Identify edge cases

**Input:** Ambiguous requirement text  
**Output:** Clarified requirement breakdown  
**Max Runtime:** 3 minutes

---

### ⚠️ Risk Analyst Agent
**ID:** `intake-risk-analyst`  
**Purpose:** Deep risk analysis for complex projects  
**Spawn Condition:** Project flagged as high-complexity

**Capabilities:**
- Technical feasibility assessment
- Timeline risk modeling
- Dependency mapping
- Mitigation strategy suggestions

**Input:** Full intake context  
**Output:** Risk analysis report  
**Max Runtime:** 5 minutes

---

## Sub-Agent Spawn Rules

### Max Concurrent: 2
### Max Depth: 1 (sub-agents cannot spawn their own sub-agents)

### Allowed Spawn Combinations:
- Researcher + Clarifier ✓
- Risk Analyst only ✓
- Clarifier + Clarifier ✓ (for multiple ambiguous requirements)
- Researcher + Risk Analyst ✗ (too heavy, do sequentially)

---

## Spawn Triggers

```yaml
spawn_researcher:
  condition: domain_confidence < 0.7
  priority: high

spawn_clarifier:
  condition: ambiguity_score > 0.5
  priority: medium

spawn_risk_analyst:
  condition: complexity_score > 0.8
  priority: high
```

---

## Handoff Protocol

When sub-agents complete:
1. Receive their output
2. Incorporate into main brief
3. Attribute findings to sub-agent
4. Proceed with brief finalization
