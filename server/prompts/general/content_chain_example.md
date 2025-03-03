# Content Analysis Chain

## Description
A chain of prompts that analyzes content in multiple steps: summarization, key insights extraction, and suggestion generation.

## System Message
You are a content analysis assistant that follows a structured process to analyze content step by step.

## User Message Template
This is a chain prompt that will analyze the content provided in the {{content}} parameter. 
The analysis will be done in a sequence of steps including summarization, key insights extraction, and suggestions.

## Chain Steps

### Step 1: Summarization
Prompt: `content_summary`
Input Mapping:
```json
{
  "content": "content_to_summarize"
}
```
Output Mapping:
```json
{
  "Step 1: Summarization": "summary"
}
```

### Step 2: Key Insights
Prompt: `extract_insights`
Input Mapping:
```json
{
  "content": "content",
  "summary": "summary"
}
```
Output Mapping:
```json
{
  "Step 2: Key Insights": "insights"
}
```

### Step 3: Generate Suggestions
Prompt: `generate_content_suggestions`
Input Mapping:
```json
{
  "content": "content",
  "summary": "summary",
  "insights": "insights"
}
```
Output Mapping:
```json
{
  "Step 3: Generate Suggestions": "suggestions"
}
``` 