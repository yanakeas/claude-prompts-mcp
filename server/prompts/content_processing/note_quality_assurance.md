# Note Quality Assurance

## Description
Comprehensive quality assurance for note-taking workflows, ensuring content preservation, structural integrity, and optimal knowledge retention

## User Message Template
[System Info: You are a quality assurance specialist for knowledge management systems. You ensure that notes meet the highest standards for content preservation, structural integrity, and knowledge retention.]

**NOTE QUALITY ASSURANCE EVALUATION**

Evaluate the following note content against comprehensive quality standards:

**NOTE CONTENT:**
```
{{ note_content }}
```

{% if original_source %}
**ORIGINAL SOURCE:**
```
{{ original_source }}
```
{% endif %}

**QUALITY STANDARDS:** {{ quality_standards | default('comprehensive') }}

**QUALITY ASSURANCE FRAMEWORK:**

## 1. CONTENT PRESERVATION AUDIT
- Verify all valuable information from source is preserved
- Check for completeness and accuracy of content representation
- Ensure no critical insights or details are lost
- Validate preservation of nuanced information and context

## 2. STRUCTURAL INTEGRITY ASSESSMENT
- Evaluate hierarchical organization and logical flow
- Check consistency of formatting and visual hierarchy
- Verify clear navigation and section relationships
- Assess scalability for future content addition

## 3. KNOWLEDGE RETENTION OPTIMIZATION
- Evaluate multiple information layers for different use cases
- Check quick reference accessibility and comprehensive depth
- Verify practical implementation guidance is clear
- Assess learning progression and skill development support

## 4. VAULT INTEGRATION EVALUATION
- Check cross-references and connection quality
- Verify metadata consistency and completeness
- Evaluate discoverability and navigation effectiveness
- Assess knowledge network integration potential

## 5. USABILITY AND ACCESSIBILITY
- Test multiple use case scenarios (quick reference, deep study, implementation)
- Evaluate readability and information density
- Check for clear entry points and navigation paths
- Assess long-term maintenance and update potential

## 6. COMPREHENSIVE QUALITY METRICS
- Content completeness score (0-100%)
- Structural organization rating (1-10)
- Knowledge retention effectiveness (1-10)
- Vault integration quality (1-10)
- Overall usability score (1-10)

**QUALITY REQUIREMENTS:**
- 100% content preservation from original source
- Clear hierarchical structure with logical flow
- Multiple information layers for different use cases
- Comprehensive cross-referencing and connections
- Optimal formatting for knowledge retention

**OUTPUT SPECIFICATIONS:**
- Detailed quality assessment report
- Specific improvement recommendations
- Content preservation verification
- Structural integrity evaluation
- Knowledge retention optimization suggestions

Provide a comprehensive quality assurance evaluation with specific actionable recommendations for improvement.
