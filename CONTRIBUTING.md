# Contributing to AutoOC

Thank you for your interest in contributing to AutoOC! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Safety First](#safety-first)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We expect all participants to:

- Be respectful and considerate
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling or deliberately disruptive behavior
- Publishing others' private information
- Any conduct that would be inappropriate in a professional setting

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Windows 10/11 (for full development)
- NVIDIA GPU (for hardware testing)
- Git
- Code editor (VS Code recommended)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/AutoOC.git
   cd AutoOC
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Project**
   ```bash
   npm run build
   ```

4. **Run in Development Mode**
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/fixes

Example: `feature/add-amd-support`

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style/formatting
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

Examples:
```
feat(optimizer): add AMD GPU support
fix(telemetry): correct memory clock readings
docs(readme): update installation instructions
```

## Coding Standards

### TypeScript Style Guide

1. **Use TypeScript strict mode**
   ```typescript
   // tsconfig.json
   "strict": true
   ```

2. **Prefer interfaces over types**
   ```typescript
   // Good
   interface GPUConfig {
     id: string;
     name: string;
   }

   // Avoid
   type GPUConfig = {
     id: string;
     name: string;
   };
   ```

3. **Use meaningful variable names**
   ```typescript
   // Good
   const maxTemperatureThreshold = 90;

   // Avoid
   const maxTemp = 90;
   const t = 90;
   ```

4. **Always handle errors**
   ```typescript
   // Good
   try {
     await applyClockOffset(offset);
   } catch (error) {
     logger.error('Failed to apply offset', error);
     throw error;
   }

   // Avoid
   await applyClockOffset(offset); // No error handling
   ```

5. **Document public APIs**
   ```typescript
   /**
    * Apply clock offset to GPU
    * @param offset - Clock offset configuration
    * @throws Error if offset cannot be applied
    */
   async applyClockOffset(offset: ClockOffset): Promise<void> {
     // implementation
   }
   ```

### File Organization

```
src/
├── backend/
│   ├── hardware/       # GPU detection & control
│   ├── optimization/   # Tuning algorithms
│   ├── stability/      # Validation & safety
│   ├── profiles/       # Profile management
│   ├── service/        # Main service
│   ├── types/          # TypeScript types
│   └── utils/          # Shared utilities
└── frontend/
    ├── components/     # Reusable UI components
    ├── views/          # Main views
    ├── api/            # Backend communication
    └── store/          # State management
```

### CSS/Styling

- Use CSS variables for theming
- Follow BEM naming convention
- Mobile-first responsive design
- Avoid inline styles

## Testing Guidelines

### Unit Tests

```typescript
describe('Optimizer', () => {
  it('should find optimal memory clock', async () => {
    const optimizer = new Optimizer(mockAPI, mockTelemetry, mockValidator);
    const result = await optimizer.tuneMemory(mockGoal);

    expect(result.clockOffset.memory).toBeGreaterThan(0);
    expect(result.clockOffset.memory).toBeLessThanOrEqual(1500);
  });
});
```

### Integration Tests

Test component interactions:
- Service startup/shutdown
- Profile save/load
- Optimization workflow
- Frontend-backend communication

### Safety Testing

**CRITICAL**: All changes that affect GPU control MUST include safety tests:

1. **Rollback Tests**
   - Verify rollback on instability
   - Confirm default profile restoration

2. **Thermal Tests**
   - Test temperature monitoring
   - Verify emergency shutdown

3. **Validation Tests**
   - Confirm all validation layers
   - Test failure detection

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# With coverage
npm run test:coverage
```

## Pull Request Process

### Before Submitting

- [ ] All tests pass
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No merge conflicts
- [ ] Branch is up to date with main

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe testing performed

## Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No console errors
- [ ] Follows coding standards

## Safety Considerations
If applicable, describe safety implications
```

### Review Process

1. Automated tests must pass
2. At least one maintainer approval required
3. No unresolved comments
4. All discussions resolved

### Merge Strategy

- Squash and merge for feature branches
- Preserve commits for major releases
- Delete branch after merge

## Safety First

### Critical Safety Rules

⚠️ **NEVER bypass safety checks in production code**

1. **Always validate before applying settings**
   ```typescript
   // Good
   if (await validator.validate(config)) {
     await apply(config);
   }

   // NEVER do this
   await apply(config); // No validation!
   ```

2. **Always provide rollback path**
   ```typescript
   try {
     await applyRiskyChange();
   } catch (error) {
     await rollbackToSafe();
     throw error;
   }
   ```

3. **Conservative defaults**
   - Start with small increments
   - Use safe temperature limits
   - Preserve stock configuration

4. **Comprehensive logging**
   - Log all configuration changes
   - Log all errors and warnings
   - Provide context for debugging

### Testing on Real Hardware

**IMPORTANT**: Test on your own hardware first

- Start with conservative settings
- Monitor temperatures closely
- Have rollback ready
- Don't test on production systems

## Documentation

### Code Documentation

- JSDoc for public APIs
- Comments for complex logic
- No obvious comments

### User Documentation

Update when adding features:
- README.md
- docs/
- In-app help text

### API Documentation

Maintain API docs for:
- Service commands
- WebSocket messages
- Configuration format

## Questions?

- Open a [Discussion](https://github.com/yourusername/AutoOC/discussions)
- Join our Discord server
- Check existing [Issues](https://github.com/yourusername/AutoOC/issues)

## Recognition

Contributors will be recognized in:
- README.md Contributors section
- Release notes
- Project website (future)

Thank you for contributing to AutoOC! 🚀
