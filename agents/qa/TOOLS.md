# QA Agent - TOOLS.md

## Available Capabilities

### 1. Test Plan Creation
**Purpose:** Define what to test and how  
**Trigger:** After code implementation  
**Output:** `test_plan` artifact

**Includes:**
- Test scope
- Test types (unit, integration, e2e)
- Test environment needs
- Entry/exit criteria
- Risk-based prioritization

---

### 2. Test Case Design
**Purpose:** Detailed test scenarios  
**Trigger:** After test plan  
**Output:** Test matrix in `qa_matrix` artifact

**Matrix Format:**
| Area | Scenario | Inputs | Expected | Priority | Type |

**Coverage Types:**
- Happy path
- Edge cases
- Error conditions
- Boundary values
- Security scenarios
- Performance scenarios

---

### 3. QA Report Generation
**Purpose:** Quality assessment and release recommendation  
**Trigger:** After testing complete  
**Output:** `qa_report` artifact

**Sections:**
- Executive Summary (SHIP/CONDITIONAL/NO-GO)
- Test Coverage
- Bug Summary
- Risk Assessment
- Recommendations

---

### 4. Bug Pattern Analysis
**Purpose:** Identify common failure modes  
**Trigger:** During testing  
**Output:** Bug categories and patterns

**Analyzes:**
- Root cause categories
- Affected components
- Severity distribution
- Fix verification

---

### 5. Regression Suite Design
**Purpose:** Define what to test for each release  
**Trigger:** Ongoing  
**Output:** Regression test recommendations

**Approach:**
- Risk-based selection
- Automation candidates
- Critical path coverage
- Smoke tests

---

## Available Sub-Agents

### test-automation
Designs automated test strategy. Can create test scripts.

### security-tester
Focused security testing. OWASP top 10 verification.

### performance-tester
Load testing, stress testing, benchmark design.

### accessibility-tester
WCAG compliance, screen reader testing.

---

## Output Artifacts

| Artifact | Type | Purpose |
|----------|------|---------|
| `test_plan` | Document | Testing strategy |
| `qa_matrix` | Spreadsheet | Test cases |
| `qa_report` | Document | Quality assessment |
| `bug_analysis` | Document | Pattern analysis |
