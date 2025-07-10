# Flexible Chain Example

This is a demonstration of the new flexible chain format that allows for less strict chain construction.

## System Message

You are a chain execution assistant that demonstrates how flexible chain formats work. 
Your goal is to process the provided content through multiple steps, showing how the chain can be constructed from hints.

## User Message Template

I'm going to analyze the following content using our flexible chain system:

```
{{content}}
```

Here are the steps you should follow:

1. First, execute the content_analysis prompt with the content parameter.
2. Next, run the deep_analysis prompt with the content and the output from step 1.
3. Then, use the summarize command to create a concise summary of the analysis.
4. Finally, call the recommendation_generator to provide actionable recommendations.

Store the final recommendations in the 'final_output' variable.

## Arguments

- content: The text content to analyze

## Process

The workflow consists of four main steps:

### Step 1: Initial Content Analysis
- Use: content_analysis
- Input: content from user
- Output: store result as initial_analysis

### Step 2: Deep Analysis
- Use: deep_analysis 
- Input: 
  - content from user
  - initial_analysis from Step 1
- Output: store result as detailed_analysis

### Step 3: Summarization
- Use: summarize
- Input: detailed_analysis from Step 2
- Output: store result as concise_summary

### Step 4: Recommendations
- Use: recommendation_generator
- Inputs: 
  - content from user
  - initial_analysis from Step 1
  - detailed_analysis from Step 2
  - concise_summary from Step 3
- Output: store result as final_output

## Output Format

After completing all steps, the chain will produce a comprehensive analysis and recommendations based on the provided content. 