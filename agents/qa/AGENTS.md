# QA Agent - AGENTS.md

## Sub-Agents

### security-tester
Security-focused test generation.
- SQL injection attempts
- XSS payloads
- Authorization bypasses
- Input validation
- Rate limit testing

**Delegation:** Security edge cases  
**Output:** Security test cases, exploit scenarios

---

### regression-suite-builder
Generates regression tests.
- Existing functionality preservation
- Edge case coverage
- Cross-version compatibility
- Breaking change detection

**Delegation:** Regression test planning  
**Output:** Regression test suite

---

### performance-tester
Load and performance testing.
- Benchmark definitions
- Load patterns
- Stress scenarios
- Performance assertions

**Delegation:** Performance requirements  
**Output:** Performance tests, benchmarks

---

### boundary-analyzer
Tests at and beyond limits.
- Boundary values
- Overflow/underflow
- Empty/null handling
- Maximum capacities

**Delegation:** Boundary conditions  
**Output:** Boundary test matrix

---

## Agent Behavior

### When to Spawn
- [ ] Complex test scenarios requiring multiple approaches
- [ ] Security-critical features
- [ ] Performance-sensitive paths
- [ ] When test matrix exceeds 50 cases

### Coordination Strategy
1. **Parallel:** Spawn testers for independent areas
2. **Sequential:** Security → Functional → Performance
3. **Merge:** Combine results into unified test plan

### Results Consolidation
```yaml
TestPlan:
  Security:
    agent: security-tester
    results: test_security.md
  Functional:
    agent: qa (self)
    results: test_functional.md
  Performance:
    agent: performance-tester
    results: test_performance.md
  Merged:
    output: test_plan_complete.md
    priority: [security, functional, performance]
```
