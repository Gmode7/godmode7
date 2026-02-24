# Intake Agent - TOOLS.md

## Available Capabilities

### 1. Questionnaire Generation
**Purpose:** Generate targeted clarifying questions  
**Trigger:** When client submits initial idea  
**Output:** Markdown questionnaire (7-12 questions)

**Question Categories:**
- Target users & personas
- Core problem definition
- Must-have vs nice-to-have features
- Technical constraints & integrations
- Timeline & budget expectations
- Success metrics
- Non-goals & scope boundaries

---

### 2. Brief Synthesis
**Purpose:** Transform answers into structured Intake Brief  
**Trigger:** After client answers questionnaire  
**Output:** `intake_brief` artifact

**Brief Sections:**
- Project Overview (2-3 sentences)
- Problem Statement
- Requirements (P0/P1/P2)
- Non-Goals / Out of Scope
- Constraints (timeline, budget, technical)
- Assumptions
- Acceptance Criteria
- Risks
- Next Steps

---

### 3. Risk Flagging
**Purpose:** Identify potential project risks  
**Trigger:** During brief synthesis  
**Output:** Risk list in brief

**Risk Categories:**
- Technical complexity
- Timeline pressure
- Scope ambiguity
- Integration dependencies
- Resource constraints

---

### 4. Scope Validation
**Purpose:** Check if scope is realistic  
**Trigger:** Before completing brief  
**Output:** Scope feasibility assessment

**Checks:**
- Feature count vs timeline
- Complexity indicators
- Integration surface area
- Novel vs proven tech

---

## Tools I Do NOT Have

❌ Code generation  
❌ Architecture design  
❌ Cost estimation  
❌ Team allocation  
❌ Legal/compliance review  

→ These belong to other agents (Engineer, Architect, PM, Security)

---

## Tool Usage Guidelines

### When to Generate Questions
- Initial client contact
- Vague or incomplete requirements
- New project intake

### When to Synthesize Brief
- Client has provided answers
- Sufficient information gathered
- Ready to hand off to PM

### When to Flag Risks
- Always! Part of every brief.
- Especially for tight timelines
- When integrating with external systems
- When scope seems large

---

## Output Artifacts

| Artifact | Type | Destination |
|----------|------|-------------|
| `intake_questions` | Questionnaire | Client-facing |
| `intake_brief` | Structured brief | PM agent input |
