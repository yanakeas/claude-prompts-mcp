# Contributing Guidelines

Thank you for your interest in contributing to the Claude Custom Prompts project! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment as described in the [Installation Guide](installation-guide.md)
4. Create a new branch for your changes

## Development Workflow

### Setting Up the Development Environment

```bash
# Install dependencies
cd server
npm install
cd ../admin-ui
npm install

# Start the server in development mode
cd server
npm run dev

# Start the admin UI in development mode
cd admin-ui
npm start
```

### Project Structure

```
claude-prompts/
├── admin-ui/           # React-based admin interface
│   ├── public/         # Static files
│   ├── src/            # Source code
│   │   ├── components/ # React components
│   │   ├── App.tsx     # Main application component
│   │   └── ...
│   └── ...
├── server/             # Node.js server
│   ├── src/            # Source code
│   │   ├── index.ts    # Main server file
│   │   └── ...
│   ├── docs/           # Documentation
│   ├── config.json     # Server configuration
│   ├── prompts.json    # Stored prompts
│   └── ...
└── ...
```

## Making Changes

### Server Changes

The server is built with Node.js and Express, using TypeScript. Key files:

- `server/src/index.ts`: Main server file
- `server/config.json`: Server configuration
- `server/prompts.json`: Stored prompts

When making changes to the server:

1. Follow the existing code style
2. Add appropriate error handling
3. Update or add tests as needed
4. Document new functionality

### Admin UI Changes

The admin UI is built with React and React Admin. Key files:

- `admin-ui/src/App.tsx`: Main application component
- `admin-ui/src/dataProvider.ts`: Data provider for React Admin
- `admin-ui/src/components/`: React components

When making changes to the admin UI:

1. Follow the existing component structure
2. Use TypeScript for type safety
3. Update or add tests as needed
4. Ensure the UI is responsive and accessible

### Documentation Changes

Documentation is written in Markdown and stored in the `server/docs/` directory. When updating documentation:

1. Follow the existing style and format
2. Ensure accuracy and clarity
3. Update the README.md if necessary
4. Check for broken links

## Testing

### Server Tests

```bash
cd server
npm test
```

### Admin UI Tests

```bash
cd admin-ui
npm test
```

## Pull Request Process

1. Create a new branch for your changes
2. Make your changes and commit them with clear, descriptive commit messages
3. Push your branch to your fork
4. Submit a pull request to the main repository
5. Ensure your PR description clearly describes the changes and their purpose
6. Link any related issues in the PR description

### Pull Request Guidelines

- Keep PRs focused on a single feature or bug fix
- Include tests for new functionality
- Update documentation as needed
- Ensure all tests pass
- Follow the existing code style

## Code Style

### TypeScript

- Use TypeScript for type safety
- Follow the existing code style
- Use interfaces for complex types
- Document public functions and interfaces

### React

- Use functional components with hooks
- Follow the existing component structure
- Use TypeScript for props and state
- Keep components focused on a single responsibility

## Versioning

We use [Semantic Versioning](https://semver.org/) for versioning:

- MAJOR version for incompatible API changes
- MINOR version for new functionality in a backward-compatible manner
- PATCH version for backward-compatible bug fixes

## Release Process

1. Update the version number in package.json
2. Update the CHANGELOG.md file
3. Create a new release on GitHub
4. Tag the release with the version number

## Reporting Issues

When reporting issues, please include:

1. A clear and descriptive title
2. Steps to reproduce the issue
3. Expected behavior
4. Actual behavior
5. Screenshots or logs if applicable
6. Environment information (OS, Node.js version, etc.)

## Feature Requests

Feature requests are welcome! When submitting a feature request:

1. Provide a clear and descriptive title
2. Describe the feature in detail
3. Explain why this feature would be useful
4. Provide examples of how the feature would be used

## Community

Join our community to discuss the project, ask questions, and get help:

- GitHub Issues: For bug reports and feature requests
- GitHub Discussions: For general discussion and questions

## License

By contributing to this project, you agree that your contributions will be licensed under the project's license.

Thank you for contributing to the Claude Custom Prompts project! 