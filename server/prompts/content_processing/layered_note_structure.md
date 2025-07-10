# Layered Note Structure Creator

## Description
Creates comprehensive note structures with multiple information layers, designed for maximum knowledge retention and multiple use cases

## User Message Template
[System Info: You are a knowledge architecture specialist who creates layered note structures that maximize information retention and utility. Your structures serve multiple use cases while preserving comprehensive information.]

**LAYERED NOTE STRUCTURE CREATION**

Create a comprehensive note structure from the analyzed content:

**ANALYZED CONTENT:**
```
{{ analyzed_content }}
```

{% if vault_context %}
**VAULT CONTEXT:**
```
{{ vault_context }}
```
{% endif %}

**STRUCTURE TYPE:** {{ structure_type | default('comprehensive') }}

**LAYERED ARCHITECTURE PRINCIPLES:**
- Multiple information layers for different use cases
- Quick reference for immediate needs
- Comprehensive content for deep study
- Implementation guidance for practical application
- Cross-references for knowledge integration
- Scalable structure for future enhancement

**REQUIRED STRUCTURE LAYERS:**

## 1. QUICK REFERENCE LAYER
- Essential insights and key takeaways
- Critical quotes and concepts
- Core methodology summary
- Immediate action items

## 2. COMPREHENSIVE METHOD GUIDE
- Detailed implementation instructions
- Step-by-step processes and protocols
- Professional applications and workflows
- Tools, techniques, and best practices

## 3. DEEP ANALYSIS LAYER
- Theoretical frameworks and foundations
- Cognitive insights and learning psychology
- Contextual understanding and implications
- Advanced applications and considerations

## 4. SYSTEMATIC BREAKDOWN
- Structured content analysis
- Evidence evaluation and quality assessment
- Logical flow and argumentation
- Gaps, limitations, and future directions

## 5. INTEGRATION LAYER
- Related notes and connections
- Cross-references and knowledge pathways
- Vault integration recommendations
- Learning progression and skill development

## 6. PRACTICE & APPLICATION
- Exercises and implementation guides
- Real-world applications and case studies
- Skill development progression
- Assessment and improvement strategies

**STRUCTURAL REQUIREMENTS:**
- Hierarchical organization with clear navigation
- Consistent formatting and visual hierarchy
- Comprehensive cross-referencing
- Scalable architecture for future content addition
- Multiple entry points for different use cases
- Knowledge retention optimization

**OUTPUT SPECIFICATIONS:**
- Complete markdown structure with all layers
- Proper heading hierarchy and formatting
- Integrated cross-references and connections
- Optimized for both quick reference and deep study
- Designed for long-term knowledge retention
