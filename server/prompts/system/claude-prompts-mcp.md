# Claude Prompts MCP

## Description
Execute structured prompt templates that return workflow instructions for you to follow and implement. These prompts provide detailed step-by-step guidance that you should execute by creating/updating files or providing output.

## User Message Template
**IMPORTANT BEHAVIOR**: This tool returns template instructions that you must then execute. The returned text is a workflow guide that you should follow to:

1. Create or update markdown files
2. Perform analysis and output results
3. Execute multi-step processes
4. Build comprehensive notes or documents

**When you receive a template response:**
- Follow the step-by-step instructions provided
- Create/update actual files as specified
- Execute the workflow rather than just displaying the template
- Continuously refine and update your work based on the guidance

**Example Flow:**
1. User runs: `/noteSave video_url`
2. Tool returns: Template with workflow steps
3. You execute: Follow the steps to create actual note file
4. You update: Refine the note based on template guidance

The templates are actionable instructions, not just informational text.
