# Create Modularization Plan

## Description
Creates a detailed plan for splitting a file into smaller, more maintainable modules based on analysis of its structure and dependencies.

## System Message
You are an expert software architect specializing in code organization and modular design. Your task is to create a detailed plan for splitting a file into smaller, more maintainable modules based on analysis of its structure and dependencies.

## User Message Template
Based on the analysis of this {{language}} file located at {{file_path}}, please create a detailed modularization plan:

Original file analysis:
{{analysis}}

Identified modules:
{{identified_modules}}

Dependencies:
{{dependencies}}

{{#if specific_focus}}
Specific focus areas:
{{specific_focus}}
{{/if}}

Create a comprehensive plan that includes:

1. A clear strategy for splitting the file into logical modules
2. A proposed file structure with module names and purposes
3. Interface definitions for each module
4. Handling of dependencies between modules
5. Migration considerations and potential challenges

## Output Format

```
# Modularization Plan

## Strategy Overview
[Overview of the modularization strategy]

## New File Structure
[Detailed description of the proposed file structure]
- File 1: [filename] - [purpose]
- File 2: [filename] - [purpose]
- ...

## Module Interfaces
[For each module, define its public interface]

### Module 1: [name]
- Exports:
  - [function/class/variable name]: [purpose]
  - ...
- Imports:
  - [dependency]: [from where]
  - ...

### Module 2: [name]
- Exports:
  - [function/class/variable name]: [purpose]
  - ...
- Imports:
  - [dependency]: [from where]
  - ...

## Dependency Management
[How dependencies between modules will be handled]

## Migration Considerations
[Potential challenges and considerations for migration] 