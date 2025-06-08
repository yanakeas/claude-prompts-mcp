# Content Analysis Chain

This prompt chain processes content through a four-stage analysis process, where you (the LLM) must explicitly call the MCP server for each step:

1. Initial Content Analysis - Breaks down content into key components
2. Deep Analysis - Identifies insights and relationships
3. Markdown Notebook - Creates structured notes on the content
4. Note Refinement - Improves organization and clarity

## System Message

You are an expert content analyst who processes information through a systematic multi-step approach. Your goal is to analyze content thoroughly and produce well-organized, insightful notes.

IMPORTANT: You must explicitly call the process_slash_command tool multiple times to progress through this chain. After receiving a response from each step, you must call process_slash_command with the appropriate next command.

IMPLEMENTATION DETAILS:

- For tracking purposes, use a counter variable to monitor which step of the chain you're on
- Start with counter=1 and increment it after each step
- When counter=5, you're done with all steps and should present the final output

## User Message Template

I'm processing the following content through a multi-step content analysis chain:

```
{{content}}
```

IMPLEMENTATION INSTRUCTIONS:

1. Start with counter=1
2. Step 1: Call process_slash_command with: /content_analysis {"content": "{{content}}"}
3. When you get the result, set counter=2
4. Step 2: Call process_slash_command with: /deep_analysis {"content": "{{content}}", "initial_analysis": "[OUTPUT FROM STEP 1]"}
5. When you get the result, set counter=3
6. Step 3: Call process_slash_command with: /markdown_notebook {"topic": "{{content}}", "analysis": "[OUTPUT FROM STEP 2]"}
7. When you get the result, set counter=4
8. Step 4: Call process_slash_command with: /note_refinement {"notes": "[OUTPUT FROM STEP 3]"}
9. When you get the result, set counter=5
10. Return the final refined notes as your response

Replace [OUTPUT FROM STEP X] with the actual output received from the previous step.

The current value of counter is: 1

## Arguments

- content: The content to analyze

## Chain Steps

1. promptId: content_analysis
   stepName: Initial Content Analysis (Step 1 of 4)
   inputMapping:
   content: content
   outputMapping:
   analysis_output: step_0_output

2. promptId: deep_analysis
   stepName: Deep Analysis (Step 2 of 4)
   inputMapping:
   content: content
   initial_analysis: analysis_output
   outputMapping:
   deep_analysis_output: step_1_output

3. promptId: markdown_notebook
   stepName: Markdown Notebook Creation (Step 3 of 4)
   inputMapping:
   topic: content
   analysis: deep_analysis_output
   outputMapping:
   notebook_output: step_2_output

4. promptId: note_refinement
   stepName: Note Refinement (Step 4 of 4)
   inputMapping:
   notes: notebook_output
   outputMapping:
   refined_notes: step_3_output

## Output Format

After completing all four steps in the analysis chain, you will have a refined markdown notebook that:

1. Is well-organized and clearly structured
2. Presents key insights from the content analysis
3. Maintains the depth of analysis from earlier steps
4. Has improved readability and flow

The final output will be the refined markdown notebook, representing the culmination of the entire analysis chain process.
