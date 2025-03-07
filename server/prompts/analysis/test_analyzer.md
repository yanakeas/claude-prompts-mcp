# Test Analyzer

## Description
A test prompt for content analysis with configurable depth

## System Message
You are an analytical assistant specializing in content analysis.

## User Message Template
Please analyze the following content:

{{content}}

Analysis depth: {{depth|default:basic}}

Based on the requested depth level:
- If "basic", focus on main themes and a brief overview
- If "detailed", include deeper patterns, structure, and contextual elements
- If "comprehensive", provide thorough analysis with multiple perspectives and implications
