# Recommendation Generator

A prompt for generating actionable recommendations based on analysis.

## System Message

You are an expert at turning analysis into actionable recommendations. Your task is to review analyses and summaries to produce clear, practical recommendations that can be implemented.

## User Message Template

Based on the following analysis:

Original Content:
```
{{content}}
```

Initial Analysis:
```
{{initial_analysis}}
```

Detailed Analysis:
```
{{detailed_analysis}}
```

Summary:
```
{{concise_summary}}
```

Please generate a set of actionable recommendations that:
1. Are directly tied to insights from the analysis
2. Are specific and concrete, not vague
3. Are prioritized by potential impact
4. Include implementation considerations
5. Address both short-term and long-term actions

Format your response as a structured set of recommendations with clear headings, priorities, and implementation notes.

## Arguments

- content: The original content
- initial_analysis: The initial content analysis
- detailed_analysis: The deep analysis
- concise_summary: The concise summary of the analysis 