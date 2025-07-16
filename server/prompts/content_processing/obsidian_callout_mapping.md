# Obsidian Callout Mapping System

## Description
Comprehensive mapping system for applying proper Obsidian callout syntax based on content type, ensuring consistent and professional formatting throughout vault notes.

## User Message Template
**OBSIDIAN CALLOUT MAPPING SYSTEM**

Apply proper Obsidian callout syntax based on content analysis:

**CONTENT TO MAP:**
```
{{ content }}
```

**COMPREHENSIVE CALLOUT TYPE MAPPING:**

**INFORMATIONAL CALLOUTS:**
- `> [!info] **Title**` - General information, overviews, context, background
- `> [!note] **Title**` - Important points, observations, insights, key findings
- `> [!abstract] **Title**` - Core principles, philosophy, executive summaries

**INSTRUCTIONAL CALLOUTS:**
- `> [!tip] **Title**` - Practical advice, recommendations, applications, best practices
- `> [!example] **Title**` - Technique breakdowns, demonstrations, code examples, step-by-step processes
- `> [!question] **Title**` - Areas for exploration, unknowns, research questions

**EVALUATIVE CALLOUTS:**
- `> [!success] **Title**` - Advantages, benefits, strategic value, positive outcomes
- `> [!warning] **Title**` - Cautions, limitations, considerations, potential issues
- `> [!failure] **Title**` - Common mistakes, pitfalls to avoid, negative outcomes
- `> [!bug] **Title**` - Technical issues, errors, problems to address

**CONTEXTUAL CALLOUTS:**
- `> [!quote] **Title**` - Master examples, historical references, citations, testimonials
- `> [!danger] **Title**` - Critical warnings, serious risks, urgent considerations
- `> [!error] **Title**` - Errors, failures, incorrect approaches

**CONTENT TYPE MAPPING RULES:**

**Technical Content:**
- Technique breakdowns → `> [!example]`
- Best practices → `> [!tip]`
- Common errors → `> [!failure]`
- Safety considerations → `> [!warning]`

**Educational Content:**
- Key concepts → `> [!abstract]`
- Practical applications → `> [!tip]`
- Historical context → `> [!quote]`
- Learning objectives → `> [!info]`

**Creative Content:**
- Artistic principles → `> [!abstract]`
- Technique demonstrations → `> [!example]`
- Master references → `> [!quote]`
- Creative insights → `> [!note]`

**Business Content:**
- Strategic advantages → `> [!success]`
- Risk factors → `> [!warning]`
- Case studies → `> [!example]`
- Market insights → `> [!info]`

**FORMATTING STANDARDS:**
- NEVER use generic blockquotes (`>`) - always use proper callout syntax
- ALWAYS include descriptive bold titles: `> [!tip] **Applications**`
- Use multi-line callouts for complex information
- Apply consistent callout types for similar information categories
- NEVER combine headings with callouts: `### > [!tip]` is invalid

**MAPPING WORKFLOW:**
1. **Content Analysis**: Identify information types and categories
2. **Callout Selection**: Choose appropriate callout types based on content function
3. **Title Creation**: Generate descriptive bold titles for each callout
4. **Syntax Application**: Apply proper Obsidian callout formatting
5. **Consistency Validation**: Ensure uniform callout usage throughout

Execute systematic callout mapping with professional formatting standards.
