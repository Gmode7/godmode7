# PM Agent - TOOLS.md

## Available Capabilities

### 1. User Story Writing
**Purpose:** Create INVEST-compliant user stories  
**Trigger:** Converting requirements to backlog  
**Output:** Structured user stories with AC

**Format:**
```
As a [user type], I want [goal], so that [benefit]

**Acceptance Criteria:**
- Given [context], when [action], then [result]
- Edge case: [scenario]

**Priority:** P0/P1/P2
**Effort:** S/M/L
```

---

### 2. PRD Generation
**Purpose:** Comprehensive product requirements document  
**Trigger:** After intake brief review  
**Output:** `prd` artifact

**Sections:**
- Problem Statement & Goals
- Target Users & Personas
- Functional Requirements
- Non-Functional Requirements
- Success Metrics
- Release Criteria

---

### 3. Backlog Creation
**Purpose:** Prioritized list of work items  
**Trigger:** After PRD  
**Output:** `backlog` artifact

**Structure:**
- Epics (major themes)
- User Stories (under epics)
- Dependencies mapped
- Sprint suggestions
- MVP vs Future delineation

---

### 4. Prioritization Framework
**Purpose:** MoSCoW prioritization  
**Trigger:** When scope exceeds capacity  
**Output:** Prioritized requirements

**Categories:**
- **Must Have** - Critical for launch
- **Should Have** - Important but not blocking
- **Could Have** - Nice if time permits
- **Won't Have** - Explicitly out of scope

---

### 5. User Persona Development
**Purpose:** Define target user archetypes  
**Trigger:** When user types are unclear  
**Output:** Persona definitions

**Includes:**
- Demographics
- Goals & motivations
- Pain points
- Current workarounds
- Technology comfort level

---

### 6. Competitive Analysis
**Purpose:** Understand market positioning  
**Trigger:** When market context matters  
**Output:** Competitive landscape summary

**Can Spawn:** `market-researcher` sub-agent

---

## Available Sub-Agents

### user-researcher
Deep-dive into specific user segments. Can conduct simulated interviews.

### competitive-analyst
Research competitors in detail. Can analyze positioning and gaps.

### metrics-designer
Define KPIs and measurement strategies.

### scope-negotiator
Help negotiate scope with stakeholders (internal simulation).

---

## Output Artifacts

| Artifact | Type | Purpose |
|----------|------|---------|
| `prd` | Document | Product Requirements |
| `backlog` | Document | Prioritized work items |
| `user_personas` | Document | Target user definitions |
| `competitive_analysis` | Document | Market context |
