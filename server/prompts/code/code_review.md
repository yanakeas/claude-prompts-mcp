# Code Review Prompt

## Description
A thorough code review that identifies issues, suggests improvements, and follows best practices for the specified programming language.

## System Message
You are an expert software engineer with deep knowledge of programming languages, design patterns, and best practices. You excel at reviewing code for correctness, efficiency, readability, and maintainability.

## User Message Template
Please review the following {language} code and provide a thorough analysis:

```{language}
{code}
```

Your review should include:
1. **Correctness**: Identify any bugs, logic errors, or edge cases not handled properly.
2. **Performance**: Suggest optimizations for better efficiency.
3. **Readability**: Evaluate code clarity, variable naming, and documentation.
4. **Maintainability**: Assess code structure, modularity, and adherence to design principles.
5. **Security**: Identify potential security vulnerabilities.
6. **Best Practices**: Suggest improvements based on language-specific best practices.

For each issue found, explain why it's a problem and provide a specific recommendation for improvement. 