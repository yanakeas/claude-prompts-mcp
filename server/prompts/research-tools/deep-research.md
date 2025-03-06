# Deep Research Chain

This prompt chain processes research topics through a six-stage research process, where you (the LLM) must explicitly call the MCP server for each step:
1. Initial Topic Exploration - Identifies key areas and questions
2. Research Planning - Creates a structured research plan
3. Deep Information Gathering - Collects and analyzes relevant information
4. Critical Analysis - Identifies key insights and patterns
5. Synthesis and Integration - Integrates findings into a cohesive framework
6. Research Report Generation - Creates a comprehensive research report

## System Message

You are an expert research specialist who conducts comprehensive research through a systematic multi-step approach. Your goal is to explore topics in depth, identify key insights, and synthesize findings into well-structured reports.

IMPORTANT: You must explicitly call the process_slash_command tool multiple times to progress through this chain. After receiving a response from each step, you must call process_slash_command with the appropriate next command.

IMPLEMENTATION DETAILS:
- For tracking purposes, use a counter variable to monitor which step of the chain you're on
- Start with counter=1 and increment it after each step
- When counter=7, you're done with all steps and should present the final output

## User Message Template

I'm conducting deep research on the following topic through a multi-step research chain:

```
{{topic}}
```

Research depth level: {{depth}}
Desired output format: {{format}}

IMPLEMENTATION INSTRUCTIONS:
1. Start with counter=1
2. Step 1: Call process_slash_command with: /topic-exploration {"topic": "{{topic}}"}
3. When you get the result, set counter=2
4. Step 2: Call process_slash_command with: /research-planning {"topic": "{{topic}}", "keyAreas": "[KEY_AREAS FROM STEP 1]", "mainQuestions": "[MAIN_QUESTIONS FROM STEP 1]", "depth": "{{depth}}"}
5. When you get the result, set counter=3
6. Step 3: Call process_slash_command with: /information-gathering {"topic": "{{topic}}", "researchPlan": "[RESEARCH_PLAN FROM STEP 2]", "subtopics": "[SUBTOPICS FROM STEP 2]", "depth": "{{depth}}"}
7. When you get the result, set counter=4
8. Step 4: Call process_slash_command with: /critical-analysis {"topic": "{{topic}}", "collectedData": "[COLLECTED_DATA FROM STEP 3]", "sourcesAnalysis": "[SOURCES_ANALYSIS FROM STEP 3]"}
9. When you get the result, set counter=5
10. Step 5: Call process_slash_command with: /synthesis-integration {"topic": "{{topic}}", "keyInsights": "[KEY_INSIGHTS FROM STEP 4]", "emergentPatterns": "[EMERGENT_PATTERNS FROM STEP 4]", "counterpoints": "[COUNTERPOINTS FROM STEP 4]"}
11. When you get the result, set counter=6
12. Step 6: Call process_slash_command with: /report-generation {"topic": "{{topic}}", "synthesizedContent": "[SYNTHESIZED_CONTENT FROM STEP 5]", "theoreticalFramework": "[THEORETICAL_FRAMEWORK FROM STEP 5]", "format": "{{format}}", "depth": "{{depth}}"}
13. When you get the result, set counter=7
14. Return the final research report as your response

Replace [X FROM STEP Y] with the actual output received from the previous step.

The current value of counter is: 1

## Arguments

- topic: The research topic to explore
- depth: The depth level of research (basic, intermediate, advanced, expert)
- format: The desired output format (essay, report, presentation, etc.)

## Chain Steps

1. promptId: topic-exploration
   stepName: Initial Topic Exploration (Step 1 of 6)
   inputMapping:
     topic: topic
   outputMapping:
     keyAreas: keyAreas
     mainQuestions: mainQuestions
     relevantContexts: relevantContexts

2. promptId: research-planning
   stepName: Research Planning (Step 2 of 6)
   inputMapping:
     topic: topic
     keyAreas: keyAreas
     mainQuestions: mainQuestions
     depth: depth
   outputMapping:
     researchPlan: researchPlan
     methodologies: methodologies
     subtopics: subtopics

3. promptId: information-gathering
   stepName: Deep Information Gathering (Step 3 of 6)
   inputMapping:
     topic: topic
     researchPlan: researchPlan
     subtopics: subtopics
     depth: depth
   outputMapping:
     collectedData: collectedData
     sourcesAnalysis: sourcesAnalysis

4. promptId: critical-analysis
   stepName: Critical Analysis (Step 4 of 6)
   inputMapping:
     topic: topic
     collectedData: collectedData
     sourcesAnalysis: sourcesAnalysis
   outputMapping:
     keyInsights: keyInsights
     emergentPatterns: emergentPatterns
     counterpoints: counterpoints

5. promptId: synthesis-integration
   stepName: Synthesis and Integration (Step 5 of 6)
   inputMapping:
     topic: topic
     keyInsights: keyInsights
     emergentPatterns: emergentPatterns
     counterpoints: counterpoints
   outputMapping:
     synthesizedContent: synthesizedContent
     theoreticalFramework: theoreticalFramework

6. promptId: report-generation
   stepName: Research Report Generation (Step 6 of 6)
   inputMapping:
     topic: topic
     synthesizedContent: synthesizedContent
     theoreticalFramework: theoreticalFramework
     format: format
     depth: depth
   outputMapping:
     finalReport: finalReport
     suggestedNextSteps: suggestedNextSteps
     limitations: limitations

## Output Format

After completing all six steps in the research chain, you will have a comprehensive research report that:

1. Is well-organized and clearly structured
2. Presents key insights and findings from the research process
3. Maintains the appropriate depth level as specified
4. Is formatted according to the requested output format
5. Includes suggested next steps and acknowledges limitations

The final output will be the complete research report, representing the culmination of the entire research chain process.
