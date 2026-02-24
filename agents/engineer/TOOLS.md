# Engineer Agent - TOOLS.md

## Available Capabilities

### 1. Engineering Plan Generation
**Purpose:** Create detailed implementation plan  
**Trigger:** After architecture review  
**Output:** `engineering_plan` artifact

**Plan Sections:**
- Implementation approach
- File/module breakdown
- Key interfaces
- Security considerations
- Risks & mitigations
- Step-by-step checklist

---

### 2. Code Generation (Patch)
**Purpose:** Generate unified diff patch  
**Trigger:** After plan approval  
**Output:** `patch` artifact

**Code Standards:**
- Follow existing project conventions
- Include error handling
- Add logging/observability
- Write self-documenting code
- Include unit tests

---

### 3. Test Generation
**Purpose:** Generate test cases  
**Trigger:** During code generation  
**Output:** Test files in patch

**Test Types:**
- Unit tests (happy path + edge cases)
- Integration tests
- Error case tests
- Security-focused tests

---

### 4. Code Review (Self)
**Purpose:** Review own code before submission  
**Trigger:** Before finalizing patch  
**Output:** Internal quality check

**Review Checklist:**
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] Error handling complete
- [ ] Tests included
- [ ] No obvious performance issues
- [ ] Follows architecture patterns

---

### 5. Dependency Analysis
**Purpose:** Check dependencies for vulnerabilities  
**Trigger:** When adding new dependencies  
**Output:** Dependency assessment

**Checks:**
- Known vulnerabilities (CVE check)
- License compatibility
- Maintenance status
- Bundle size impact

---

## Available Sub-Agents (Phase 2)

### test-writer
Generates comprehensive test suite. Can run in parallel with main coding.

### security-reviewer
Focused security audit of generated code. Spawns after initial implementation.

### performance-analyst
Checks for performance bottlenecks. Optional for performance-critical features.

### docs-sync
Updates inline documentation. Spawns after code freeze.

---

## Tool Constraints

### File Size Limits
- Single file: Max 500 lines
- Function: Max 50 lines
- If larger: refactor into smaller units

### Dependencies
- Prefer standard library
- Check with Architect before adding new deps
- Document why each dep is needed

### Testing Requirements
- Unit tests: Min 80% coverage
- Integration tests: For external boundaries
- Error cases: Must be tested

---

## Output Artifacts

| Artifact | Type | Description |
|----------|------|-------------|
| `engineering_plan` | Markdown | Implementation strategy |
| `patch` | Unified diff | Actual code changes |
| `test_plan` | Markdown | Generated test strategy (input to QA) |
