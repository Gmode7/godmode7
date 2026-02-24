# PM Agent - AGENTS.md

## Sub-Agent Definitions

### 🔍 User Researcher
**ID:** `pm-user-researcher`  
**Purpose:** Deep-dive into user needs and behaviors  
**Spawn Condition:** User context insufficient or unclear

**Capabilities:**
- User interview simulation
- Persona development
- Jobs-to-be-Done analysis
- Pain point identification

**Input:** Target user segment, known context  
**Output:** User research summary with insights  
**Max Runtime:** 10 minutes

---

### 📊 Competitive Analyst
**ID:** `pm-competitive-analyst`  
**Purpose:** Analyze competitive landscape  
**Spawn Condition:** Market positioning unclear

**Capabilities:**
- Competitor feature analysis
- Positioning gap identification
- Market trend research
- Differentiation strategy

**Input:** Product category, key competitors  
**Output:** Competitive analysis report  
**Max Runtime:** 8 minutes

---

### 📈 Metrics Designer
**ID:** `pm-metrics-designer`  
**Purpose:** Define success metrics framework  
**Spawn Condition:** Success criteria unclear

**Capabilities:**
- KPI framework design
- Measurement strategy
- Counter-metric identification
- Dashboard specifications

**Input:** Product goals  
**Output:** Metrics framework document  
**Max Runtime:** 5 minutes

---

### ✂️ Scope Negotiator
**ID:** `pm-scope-negotiator`  
**Purpose:** Help define MVP vs full scope  
**Spawn Condition:** Scope exceeds capacity or timeline

**Capabilities:**
- MVP identification
- Scope slicing strategies
- Trade-off analysis
- Stakeholder argument preparation

**Input:** Full requirements, constraints  
**Output:** Scoped backlog recommendations  
**Max Runtime:** 5 minutes

---

## Sub-Agent Spawn Rules

### Max Concurrent: 2
### Max Depth: 1

### Allowed Combinations:
- User Researcher + Competitive Analyst ✓
- Metrics Designer + Scope Negotiator ✓
- User Researcher only ✓
- All four in sequence (not parallel) ✓

### Spawn Triggers

```yaml
spawn_user_researcher:
  condition: user_context_gaps > 3
  priority: high

spawn_competitive_analyst:
  condition: market_context == null
  priority: medium

spawn_metrics_designer:
  condition: success_metrics_undefined
  priority: high

spawn_scope_negotiator:
  condition: story_count > capacity_estimate * 2
  priority: medium
```

---

## Parallel Execution Example

When starting a new product:

1. **Spawn:** `user-researcher` + `competitive-analyst`
2. **Collect:** User insights + Market gaps
3. **Synthesize:** Into PRD sections
4. **Spawn:** `metrics-designer` (parallel with writing)
5. **Review:** Scope and spawn `scope-negotiator` if needed
6. **Finalize:** Complete PRD and backlog

---

## Sub-Agent Output Integration

All sub-agent outputs are:
1. Incorporated into main artifacts
2. Credited in documentation
3. Used to inform downstream decisions
4. Available to other agents in pipeline
