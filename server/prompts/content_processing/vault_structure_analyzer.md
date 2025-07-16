# Vault Structure Analyzer

## Description
Analyzes vault structure to identify existing notes, MOCs, and connection opportunities for systematic integration. Provides real vault context for other workflow steps.

## User Message Template
[System Info: You are a vault structure specialist who analyzes existing note hierarchies and identifies real connection opportunities for new content integration.]

**VAULT STRUCTURE ANALYSIS**

Analyze the vault structure and identify integration opportunities for new content:

**CONTENT TOPIC/DOMAIN:** {{content_topic}}
**VAULT ROOT PATH:** {{vault_path}}

**ANALYSIS REQUIREMENTS:**

### **Step 1: Scan for Relevant Existing Notes**

#### **Primary Domain Discovery**
- Identify the main MOC that should house this content
- List existing notes in related directories
- Find established categorization patterns
- Locate relevant case studies and references

#### **Cross-Domain Opportunities**
- Scan related domains for connection points
- Identify shared themes across different areas
- Find historical/cultural context notes
- Locate methodology and technique overlaps

### **Step 2: Hierarchical Mapping**

#### **MOC Structure Analysis**
- Which main MOC is most relevant?
- What subdirectories exist within that domain?
- How are similar topics currently organized?
- What naming conventions are used?

#### **Connection Patterns**
- How do existing notes link to each other?
- What tagging patterns are established?
- Which notes frequently cross-reference?
- What discovery paths currently exist?

### **Step 3: Integration Recommendations**

#### **Placement Strategy**
- Optimal directory location for new note
- Suggested file naming convention
- Recommended tag structure alignment
- MOC integration approach

#### **Connection Opportunities**
- **Direct Links**: Notes directly related to topic
- **Contextual Links**: Historical/cultural background notes
- **Methodological Links**: Similar techniques/approaches
- **Contemporary Links**: Modern applications/influence

### **OUTPUT FORMAT:**

```markdown
## Vault Structure Analysis

### Primary Integration Domain
- **Target MOC**: [Existing MOC Name]
- **Directory Path**: [Actual path]
- **Existing Related Notes**: 
  - [Real note 1]
  - [Real note 2]
  - [Real note 3]

### Connection Opportunities
- **Parent Connections**: [Existing higher-level notes]
- **Peer Connections**: [Notes at same level]
- **Child Connections**: [Specific subtopics]
- **Cross-Domain**: [Related notes in other domains]

### Integration Recommendations
- **File Placement**: [Suggested location]
- **Naming Convention**: [Follow existing patterns]
- **Tag Alignment**: [Use established tags]
- **MOC Updates**: [Which MOCs need updating]
```

**Use LS and Read tools to scan the actual vault structure and provide real file paths and note names. Do not suggest connections to non-existent notes.**
