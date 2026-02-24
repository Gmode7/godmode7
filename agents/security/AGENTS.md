# Security Agent - AGENTS.md

## Sub-Agent Definitions

### 🎯 Penetration Tester
**ID:** `sec-penetration-tester`  
**Purpose:** Simulate real attacks  
**Spawn Condition:** High-security requirements

**Capabilities:**
- Exploit vulnerability chains
- Post-exploitation analysis
- Privilege escalation
- Data exfiltration testing
- Report with CVSS scores

**Input:** Application, infrastructure  
**Output:** Penetration test report  
**Max Runtime:** 15 minutes

---

### 💻 Code Security Reviewer
**ID:** `sec-code-reviewer`  
**Purpose:** Deep code analysis  
**Spawn Condition:** Complex code or high-risk features

**Capabilities:**
- SAST (Static Application Security Testing)
- Business logic flaws
- Race conditions
- Injection vulnerabilities
- Authentication flaws

**Input:** Source code  
**Output:** Code security findings  
**Max Runtime:** 10 minutes

---

### 📋 Compliance Auditor
**ID:** `sec-compliance-auditor`  
**Purpose:** Compliance verification  
**Spawn Condition:** Compliance requirements

**Capabilities:**
- Framework mapping (SOC2, ISO27001, GDPR)
- Gap analysis
- Control assessment
- Evidence collection

**Input:** System, compliance framework  
**Output:** Compliance report  
**Max Runtime:** 8 minutes

---

### 🔐 Crypto Reviewer
**ID:** `sec-crypto-reviewer`  
**Purpose:** Cryptographic review  
**Spawn Condition:** Custom crypto or key management

**Capabilities:**
- Algorithm selection
- Implementation review
- Key management analysis
- Randomness verification
- Side-channel assessment

**Input:** Cryptographic implementations  
**Output:** Crypto review report  
**Max Runtime:** 8 minutes

---

## Sub-Agent Spawn Rules

### Max Concurrent: 2
### Max Depth: 1

### Common Combinations:
- Penetration + Code Review ✓ (comprehensive assessment)
- Compliance + Crypto ✓ (regulated + crypto-heavy)

### Spawn Triggers

```yaml
spawn_penetration_tester:
  condition: high_value_target OR external_facing
  priority: high

spawn_code_reviewer:
  condition: custom_auth OR payment_processing
  priority: high

spawn_compliance_auditor:
  condition: compliance_required
  priority: medium

spawn_crypto_reviewer:
  condition: custom_crypto OR key_management
  priority: high
```

---

## Full Security Assessment

For high-security application:

1. **Spawn:** `code-reviewer` + `penetration-tester`
2. **Parallel:** Code analysis + active testing
3. **Spawn:** `compliance-auditor` (if needed)
4. **Integrate:** All findings into unified report
5. **Prioritize:** By CVSS score
6. **Remediate:** Track fix verification

---

## Critical Security Scenario

For payment processing:

1. **Spawn:** `crypto-reviewer` (key management)
2. **Spawn:** `code-reviewer` (auth logic)
3. **Spawn:** `penetration-tester` (attack simulation)
4. **Report:** Comprehensive security findings
5. **Track:** All critical findings to resolution
