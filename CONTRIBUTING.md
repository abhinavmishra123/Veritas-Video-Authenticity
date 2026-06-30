# Contributing to Veritas Protocol

Thank you for your interest in contributing to the Veritas Protocol! As an open-source project, we welcome contributions from developers, researchers, and cryptography enthusiasts.

## Code of Conduct

By participating in this project, you agree to maintain a respectful, inclusive, and harassment-free environment for everyone.

## Getting Started

1. **Fork the Repository**: Start by forking the Veritas repository to your own GitHub account.
2. **Clone the Repository**: Clone your fork to your local machine.
3. **Environment Setup**: Ensure you have Docker and Docker Compose installed.

### Running Locally

We use Docker to ensure cross-platform compatibility across Windows/WSL, macOS (Intel and Apple Silicon), and Linux. 

To start the local development environment:

```bash
docker-compose up --build
```

This will spin up:
- The Veritas API backend on port `3000`
- The Veritas Capture frontend on port `5173`
- The local SQLite database via Docker volumes

## Submitting Pull Requests

1. **Create a Branch**: Create a feature branch for your changes (`git checkout -b feature/your-feature-name`).
2. **Commit Changes**: Make your changes and commit them with descriptive commit messages.
3. **Test**: Ensure that the application builds and runs smoothly across different architectures. Check that the `compareVisualFrames` pHash engine and cryptographic validations work as expected.
4. **Open a PR**: Submit a Pull Request against the `main` branch. Provide a clear description of the problem solved or feature added.

## Bug Reports and Feature Requests

Please use GitHub Issues to report bugs or request features. When submitting a bug report, include your operating system, Docker version, and steps to reproduce the issue.

We look forward to building a decentralized and transparent media future together!
