# Coding Solution Chain

## Description
A comprehensive process that refines user coding requests and then provides expert implementation with explanations, best practices, and error handling.

## User Message Template
I need a complete coding solution for this request: {{query}}

## Chain Steps

1. promptId: query_refinement
   stepName: Query Refinement (Step 1 of 2)
   inputMapping:
     query: query
   outputMapping:
     refined_query: refined_query
     language: language
     requirements: requirements
     constraints: constraints

2. promptId: expert_code_implementation
   stepName: Expert Code Implementation (Step 2 of 2)
   inputMapping:
     refined_query: refined_query
     language: language
     requirements: requirements
     constraints: constraints
   outputMapping:
     solution_code: solution_code
     explanation: explanation
     usage_examples: usage_examples

## Output Format

After completing all 2 steps in the chain, you will have a final output that:

1. Is well-organized and clearly structured
2. Represents the culmination of the entire chain process

The final output will be the result of the last step in the chain.
