# Security Agent - TOOLS.md

## Available Capabilities

### 1. Threat Modeling
**Purpose:** Systematic security analysis  
**Trigger:** After architecture review  
**Output:** `threat_model` artifact

**Method:** STRIDE
- **S**poofing
- **T**ampering
- **R**epudiation
- **I**nformation Disclosure
- **D**enial of Service
- **E**levation of Privilege

**Output:**
- Threats identified
- Attack vectors
- Risk ratings
- Mitigation strategies

---

### 2. Security Audit
**Purpose:** Find vulnerabilities in code/design  
**Trigger:** After implementation  
**Output:** `security_findings` artifact

**Categories:**
- Authentication/Authorization flaws
- Input validation issues
- Data protection gaps
- Configuration weaknesses
- Dependency vulnerabilities

---

### 3. Security Review
**Purpose:** Review architecture/code for security  
**Trigger:** Design and implementation phases  
**Output:** Security recommendations

**Focus Areas:**
- Authentication mechanisms
- Session management
- Access controls
- Data handling
- Audit logging

---

### 4. Compliance Mapping
**Purpose:** Map to security standards  
**Trigger:** When compliance required  
**Output:** Compliance assessment

**Standards:**
- OWASP Top 10
- CWE Top 25
- NIST CSF
- ISO 27001
- SOC 2

---

## Available Sub-Agents

### penetration-tester
Simulates real attacks. Finds exploitable vulnerabilities.

### code-security-reviewer
Deep code analysis. Finds implementation vulnerabilities.

### compliance-auditor
Maps to specific compliance frameworks. Gap analysis.

### crypto-reviewer
Reviews cryptographic implementations. Key management.

---

## Output Artifacts

| Artifact | Type | Purpose |
|----------|------|---------|
| `threat_model` | Document | Security threats |
| `security_findings` | Document | Vulnerability list |
| `compliance_map` | Document | Compliance status |
| `security_fix_plan` | Document | Remediation plan |
