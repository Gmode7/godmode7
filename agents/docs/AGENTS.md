# Docs Agent - AGENTS.md

## Sub-Agents

### example-creator
Creates comprehensive code examples.
- Multiple languages
- Progressive complexity
- Real-world scenarios
- Tested code

**Delegation:** Example creation  
**Output:** Working code samples

---

### tutorial-writer
Long-form tutorials with learning objectives.
- Beginner to advanced paths
- Step-by-step instructions
- Checkpoints and validation
- Common mistakes section

**Delegation:** Tutorial content  
**Output:** Tutorial markdown

---

### style-guide-enforcer
Ensures consistency across docs.
- Terminology consistency
- Format validation
- Link checking
- Cross-reference validation

**Delegation:** Final review  
**Output:** Style compliance report

---

### diagram-creator
Creates architecture diagrams.
- System architecture
- Data flow
- Sequence diagrams
- Entity relationships

**Delegation:** Visual explanations  
**Output:** Diagram files + descriptions

---

## Agent Behavior

### When to Spawn
- [ ] Multiple code examples needed
- [ ] Tutorial requires structured learning path
- [ ] Large doc set needs consistency check
- [ ] Architecture documentation needed

### Coordination Strategy
1. **Parallel:** Examples + Diagrams simultaneously
2. **Sequential:** Draft → Style check → Final
3. **Review:** Style-guide-enforcer validates output

### Results Consolidation
```yaml
Docs:
  API:
    agent: docs (self)
    output: docs_api.md
  Examples:
    agent: example-creator
    output: examples/
  Tutorial:
    agent: tutorial-writer
    output: tutorial.md
  Review:
    agent: style-guide-enforcer
    output: style_report.md
```
