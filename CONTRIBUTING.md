# Contributing to AxonPuls Platform

Thank you for your interest in contributing to AxonPuls! We welcome contributions from the community and are grateful for your help in making this project better.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Git
- Docker (optional)

### Development Setup

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub, then clone your fork
   git clone https://github.com/your-username/core.git
   cd core
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp apps/api/.env.example apps/api/.env
   # Edit .env with your local database credentials
   ```

4. **Set up database**
   ```bash
   cd apps/api
   npx prisma migrate dev
   npx prisma generate
   cd ../..
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

### Project Structure

```
core/
├── apps/
│   ├── api/              # NestJS backend
│   ├── docs/             # Next.js documentation
│   └── web/              # Demo web application
├── packages/
│   ├── sdk/              # Core SDK (@axonstream/core)
│   ├── react-hooks/      # React integration (@axonstream/react)
│   ├── cli/              # Command-line tools (@axonstream/cli)
│   └── ui/               # Shared UI components
├── monitoring/           # Grafana dashboards & Prometheus config
└── docker/              # Docker configurations
```

## Development Process

### Branching Strategy

We use a simplified Git Flow:

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/description` - Feature branches
- `fix/description` - Bug fix branches
- `hotfix/description` - Critical production fixes

### Workflow

1. **Create a feature branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code following our [coding standards](#coding-standards)
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm test
   npm run test:e2e
   npm run build
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create PR on GitHub
   ```

## Pull Request Process

### Before Submitting

- [ ] All tests pass (`npm test`)
- [ ] Code builds successfully (`npm run build`)
- [ ] ESLint checks pass (`npm run lint`)
- [ ] TypeScript compilation is clean (`npm run type-check`)
- [ ] Documentation updated (if applicable)
- [ ] Changeset added for public packages (`npx changeset`)

### PR Template

Please use our PR template and include:

1. **Description** - What does this PR do?
2. **Type of Change** - Bug fix, feature, breaking change, etc.
3. **Testing** - How has this been tested?
4. **Screenshots** - If UI changes
5. **Checklist** - All requirements met

### Review Process

1. **Automated Checks** - CI must pass
2. **Code Review** - At least one maintainer approval
3. **Manual Testing** - For significant changes
4. **Documentation Review** - For public API changes

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Prefer interfaces over types for object shapes
- Use strict mode configuration
- Export types alongside implementations

```typescript
// Good
export interface UserConfig {
  apiKey: string;
  timeout?: number;
}

export class AxonPulsClient {
  constructor(config: UserConfig) {
    // implementation
  }
}

// Avoid
export type UserConfig = {
  apiKey: string;
  timeout?: number;
}
```

### Code Style

- Use ESLint and Prettier configurations
- 2-space indentation
- No trailing semicolons
- Single quotes for strings
- Trailing commas where valid

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`

```typescript
// Files
user-service.ts
magic-operations.service.ts

// Classes & Interfaces
class MagicRoom { }
interface ConnectionOptions { }

// Functions & Variables
const createConnection = () => { }
let connectionTimeout = 5000

// Constants
const DEFAULT_RETRY_ATTEMPTS = 3
```

### Comments

- Use JSDoc for public APIs
- Add inline comments for complex logic
- Explain "why" not "what"

```typescript
/**
 * Creates a new Magic collaboration room with operational transform capabilities.
 * 
 * @param roomId - Unique identifier for the room
 * @param options - Configuration options for the room
 * @returns Promise resolving to the created room instance
 * 
 * @example
 * ```typescript
 * const room = await magic.createRoom('doc-123', {
 *   timeTravel: true,
 *   presence: true
 * });
 * ```
 */
async createRoom(roomId: string, options: RoomOptions): Promise<MagicRoom> {
  // Use exponential backoff for connection retries to avoid overwhelming the server
  const connection = await this.connectWithRetry()
  // ...
}
```

## Testing Requirements

### Unit Tests

- Write tests for all public APIs
- Use Jest as the testing framework
- Aim for >90% code coverage
- Test edge cases and error conditions

```typescript
// tests/magic-room.test.ts
describe('MagicRoom', () => {
  it('should create room with default options', async () => {
    const room = await magic.createRoom('test-room');
    expect(room.id).toBe('test-room');
    expect(room.options.timeTravel).toBe(false);
  });

  it('should handle connection failures gracefully', async () => {
    mockConnection.mockRejectedValue(new Error('Connection failed'));
    await expect(magic.createRoom('test')).rejects.toThrow('Connection failed');
  });
});
```

### Integration Tests

- Test full workflows
- Use test containers for databases
- Mock external services

### E2E Tests

- Test critical user paths
- Use Playwright for browser testing
- Include WebSocket connection tests

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests  
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Documentation

### API Documentation

- Use JSDoc for all public APIs
- Include examples in documentation
- Update TypeScript declarations
- Generate docs with TypeDoc

### User Documentation

- Update README for new features
- Add examples to docs site
- Include migration guides for breaking changes
- Maintain changelog

### Examples

Create examples for new features:

```typescript
// examples/magic-collaboration.ts
import { AxonPulsClient } from '@axonstream/core';

async function collaborativeDocumentExample() {
  const client = new AxonPulsClient({ apiKey: 'demo-key' });
  
  // Your example here...
}
```

## Issue Reporting

### Bug Reports

Include:
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Code samples (if applicable)

### Feature Requests

Include:
- Use case description
- Proposed API (if applicable)
- Alternative solutions considered
- Implementation willingness

## Community

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and ideas
- **Discord** - Real-time community chat
- **Email** - security@axonpuls.com for security issues

### Getting Help

1. Check existing documentation
2. Search GitHub issues
3. Ask in GitHub Discussions
4. Join our Discord community

## Release Process

### Versioning

We use Semantic Versioning (SemVer):
- **MAJOR** - Breaking changes
- **MINOR** - New features (backwards compatible)
- **PATCH** - Bug fixes (backwards compatible)

### Changesets

Use changeset for version management:

```bash
# Add changeset for your changes
npx changeset

# Follow prompts to describe changes
# Commit the generated changeset file
```

## Recognition

Contributors will be:
- Added to the README contributors section
- Mentioned in release notes for significant contributions
- Invited to join the core contributors team (for regular contributors)

## Questions?

If you have questions about contributing, please:
1. Check this document first
2. Search existing GitHub discussions
3. Create a new discussion
4. Reach out on Discord

Thank you for contributing to AxonPuls! 🚀
