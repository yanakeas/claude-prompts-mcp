# Test Chain

## Description
A test chain prompt with random information for testing purposes

## User Message Template
This is a test chain with random information. The current topic is: {{topic}}. Additional context: {{context}}

## Chain Steps

1. promptId: generate_random_facts
   stepName: Step 1: Generate Random Facts (Step 1 of 2)
   inputMapping:
     topic: topic
   outputMapping:
     facts: random_facts

2. promptId: create_test_summary
   stepName: Step 2: Create Test Summary (Step 2 of 2)
   inputMapping:
     facts: random_facts
     context: context
   outputMapping:
     summary: final_summary

## Output Format

After completing all 2 steps in the chain, you will have a final output that:

1. Is well-organized and clearly structured
2. Represents the culmination of the entire chain process

The final output will be the result of the last step in the chain.
