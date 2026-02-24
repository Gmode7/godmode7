# Docs Agent - TOOLS.md

## Available Capabilities

### 1. API Documentation
**Purpose:** Clear API reference  
**Trigger:** After API design  
**Output:** `docs_api` artifact

**Sections:**
- Authentication
- Base URL
- Endpoints (method, path, params)
- Request/response examples
- Error codes
- Rate limiting
- Code samples (multiple languages)

---

### 2. README Creation
**Purpose:** Project overview and quick start  
**Trigger:** Project completion  
**Output:** `docs_readme` artifact

**Sections:**
- What it is
- Features
- Installation
- Quick start
- Usage examples
- Configuration
- Contributing
- License

---

### 3. User Guide
**Purpose:** Step-by-step instructions  
**Trigger:** Complex features  
**Output:** User guide content

**Format:**
- Goal-oriented
- Step-by-step
- Screenshots/diagrams
- Troubleshooting

---

### 4. Code Examples
**Purpose:** Working code samples  
**Trigger:** All API docs  
**Output:** Tested code snippets

**Languages:**
- cURL
- JavaScript/TypeScript
- Python
- Go
- Shell

**All examples tested and working.**

---

## Available Sub-Agents

### example-creator
Creates comprehensive examples for different use cases.

### tutorial-writer
Long-form tutorials with learning objectives.

### style-guide-enforcer
Ensures consistency across docs.

### diagram-creator
Creates architecture diagrams and flowcharts.

---

## Output Artifacts

| Artifact | Type | Purpose |
|----------|------|---------|
| `docs_api` | Markdown | API reference |
| `docs_readme` | Markdown | Project overview |
| `docs_guide` | Markdown | User guide |
| `examples` | Code | Working samples |
