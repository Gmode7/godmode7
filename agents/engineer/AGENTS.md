# Engineer Agent - AGENTS.md

## Sub-Agents

### frontend-specialist
Deep frontend implementation expertise.
- React/Component architecture
- State management
- CSS/styling
- Accessibility (a11y)
- Frontend testing

**Delegation:** Complex UI components  
**Output:** Frontend implementation

---

### backend-specialist
Server-side implementation focus.
- Database design
- API implementation
- Authentication/AuthZ
- Service architecture
- Background jobs

**Delegation:** Backend services  
**Output:** Server implementation

---

### test-writer
Comprehensive test coverage.
- Unit tests
- Integration tests
- Mock/stub creation
- Test utilities

**Delegation:** Test generation  
**Output:** Test suites

---

### code-reviewer
Thorough code review.
- Best practices
- Performance issues
- Security concerns
- Style violations

**Delegation:** Pre-commit review  
**Output:** Review comments, suggestions

---

## Agent Behavior

### When to Spawn
- [ ] Feature spans frontend and backend
- [ ] Complex UI component needed
- [ ] Database schema redesign
- [ ] Test coverage below threshold
- [ ] Code review backlog

### Coordination Strategy
1. **Parallel:** Frontend + Backend simultaneously
2. **Sequential:** Implementation → Tests → Review
3. **Merge:** Combine implementations into feature branch

### Results Consolidation
```yaml
Implementation:
  Frontend:
    agent: frontend-specialist
    output: components/, pages/
  Backend:
    agent: backend-specialist
    output: routes/, services/
  Tests:
    agent: test-writer
    output: tests/
  Review:
    agent: code-reviewer
    output: review.md
  Final:
    agent: engineer (self)
    output: Implementation ready for QA
```
