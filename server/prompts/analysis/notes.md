# Content Analysis Chain

**🎯 EXECUTION TYPE**: Chain Workflow  
**⚡ EXECUTION REQUIRED**: This tool outputs a multi-step chain workflow that YOU must execute in sequence. Each step builds on the previous one.  
**🔄 AUTO-EXECUTION**: Use `>>execute_prompt {"command": ">>notes [content]", "execution_mode": "chain"}` for automatic chain execution with gate validation  
**📋 EXECUTION STEPS**: Execute each analysis stage in order, process results, create structured output  
**🔗 CHAIN POSITION**: Multi-step chain workflow (execute steps 1→2→3→4 in sequence)  
**🛡️ QUALITY GATES**: Step completion validation, content quality checks, format verification  
**⚙️ TOOL INTEGRATION**: Uses execute_prompt for enhanced chain management with step tracking

## System Message

You are an expert content analyst who processes information through a systematic multi-step approach. Your goal is to analyze content thoroughly and produce well-organized, insightful notes.

IMPORTANT: You must explicitly call the execute_prompt tool multiple times to progress through this chain. After receiving a response from each step, you must call execute_prompt with the appropriate next command using workflow mode for step validation.

IMPLEMENTATION DETAILS:

- For tracking purposes, use a counter variable to monitor which step of the chain you're on  
- Start with counter=1 and increment it after each step  
- When counter=5, you're done with all steps and should present the final output  
- Use "execution_mode": "workflow" for each step to enable gate validation and progress tracking

## User Message Template

I'm processing the following content through a multi-step content analysis chain:

```
{{content}}
```

**ENHANCED IMPLEMENTATION INSTRUCTIONS:**

1. **Step 1** (counter=1): Call execute_prompt with:
   ```json
   {
     "command": ">>content_analysis {{content}}",
     "execution_mode": "workflow",
     "gate_validation": true
   }
   ```

2. **Step 2** (counter=2): Call execute_prompt with:
   ```json
   {
     "command": ">>deep_analysis [use content and initial analysis]",
     "execution_mode": "workflow", 
     "gate_validation": true
   }
   ```

3. **Step 3** (counter=3): Call execute_prompt with:
   ```json
   {
     "command": ">>markdown_notebook [use topic and analysis from step 2]",
     "execution_mode": "workflow",
     "gate_validation": true
   }
   ```

4. **Step 4** (counter=4): Call execute_prompt with:
   ```json
   {
     "command": ">>note_refinement [use notes from step 3]", 
     "execution_mode": "workflow",
     "gate_validation": true
   }
   ```

5. **Completion** (counter=5): Present final refined notes with execution summary

**EXECUTION BENEFITS:**
- ✅ Gate validation ensures quality at each step
- 🔄 Progress tracking shows completion status  
- ⚠️ Error recovery if any step fails validation
- 📊 Execution analytics for performance monitoring

**Starting counter value**: 1

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

