# Intelligent Analysis Test

## Description
Test prompt for intelligent semantic analysis without any execution headers. This should be automatically detected as a workflow based on content analysis.

## System Message
You are an intelligent analysis assistant. Your task is to systematically evaluate and process the provided information.

## User Message Template

Please analyze the following data systematically:

{{data}}

**STEP-BY-STEP ANALYSIS PROCESS:**

### 1. Data Assessment
- Examine the structure and format of the provided data
- Identify key patterns and relationships
- Note any anomalies or interesting characteristics

### 2. Content Breakdown
- Extract the main themes and topics
- Categorize information by relevance and importance
- Summarize key findings in each category

### 3. Critical Evaluation
- Assess the quality and reliability of the information
- Identify potential biases or limitations
- Compare with known standards or benchmarks

### 4. Insights Generation
- Draw meaningful conclusions from the analysis
- Identify actionable recommendations
- Highlight areas requiring further investigation

### 5. Structured Summary
Present your findings in a clear, organized format with:
- Executive summary
- Detailed findings by category
- Recommended next steps

**Execute each step methodically to ensure comprehensive analysis.**

## Arguments
- data: The information or content to be analyzed (required)