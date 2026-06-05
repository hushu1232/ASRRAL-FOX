# Contributing to AstralFox Rigging Pipeline

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Python 3.10+
- Git
- CUDA-capable GPU (optional, for AI model development)

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/astralfox-rigging.git
cd astralfox-rigging

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/macOS
# or
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Install development dependencies
pip install pytest ruff mypy
```

## Project Structure

```
astralfox-rigging/
├── api/                    # FastAPI application
│   ├── main.py            # App entry point
│   ├── schemas.py         # Pydantic models
│   ├── routes/            # API endpoints
│   └── progress.py        # SSE progress tracking
├── ai_engine/             # AI/ML modules
│   ├── layer_separator.py # Image segmentation
│   ├── bone_predictor.py  # Skeleton prediction
│   └── weight_painter.py  # Weight painting
├── cubism_bridge/         # Cubism format handlers
│   ├── cmo3_writer.py     # .cmo3/.model3.json writer
│   ├── moc3_encoder.py    # .moc3 binary encoder
│   └── physics_config.py  # Physics simulation
├── deploy/                # Deployment module
├── astralfox_adapter/     # AstralFox integration
├── ui/                    # Gradio web interface
├── tests/                 # Test suite
└── docs/                  # Documentation
```

## Code Style

We use Ruff for linting and formatting:

```bash
# Check code style
ruff check .

# Auto-fix issues
ruff check --fix .

# Format code
ruff format .
```

### Style Guidelines

- Follow PEP 8
- Use type hints for all function signatures
- Write docstrings for all public functions and classes
- Keep functions focused and small
- Use descriptive variable names

## Testing

### Running Tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_cubism.py

# Run with coverage
pytest --cov=. --cov-report=html
```

### Writing Tests

- Place tests in the `tests/` directory
- Name test files as `test_*.py`
- Use descriptive test function names
- Use fixtures for common setup
- Mock external dependencies (GPU, file system)

Example:

```python
def test_mesh_generator_produces_valid_mesh():
    """MeshGenerator should produce valid triangle mesh from mask."""
    mask = np.zeros((100, 100), dtype=np.uint8)
    cv2.circle(mask, (50, 50), 40, 255, -1)

    gen = MeshGenerator(density="medium")
    mesh = gen.generate(mask)

    assert mesh.vertex_count >= 3
    assert mesh.triangle_count >= 1
    assert mesh.uvs.min() >= 0.0
    assert mesh.uvs.max() <= 1.0
```

## Making Changes

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Code refactoring

### Commit Messages

Follow conventional commits:

```
feat: add new mesh density option
fix: correct UV coordinate calculation
docs: update API documentation
test: add tests for bone predictor
refactor: simplify weight normalization
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run tests: `pytest`
4. Run linter: `ruff check .`
5. Push and create a Pull Request
6. Wait for review and CI checks

## Adding New Features

### Adding a New API Endpoint

1. Define request/response schemas in `api/schemas.py`
2. Create route handler in `api/routes/`
3. Register router in `api/main.py`
4. Add tests in `tests/test_api.py`
5. Update API documentation

### Adding a New AI Model

1. Create module in `ai_engine/`
2. Implement `separate()` or `predict()` method
3. Add to `create_separator()` factory if applicable
4. Add preloading in `ai_engine/__init__.py`
5. Add tests with mocked model

### Adding a New Cubism Format

1. Create handler in `cubism_bridge/`
2. Implement read/write methods
3. Add validation in `deploy/validator.py`
4. Add tests in `tests/test_cubism.py`

## Debugging

### Common Issues

**CUDA out of memory:**
```bash
# Use CPU fallback
export CUDA_VISIBLE_DEVICES=""
```

**Import errors:**
```bash
# Ensure project root is in path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

**Test failures:**
```bash
# Run with verbose output
pytest -xvs tests/test_failing.py
```

## Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] New features have tests
- [ ] Docstrings are updated
- [ ] Type hints are present
- [ ] No hardcoded values
- [ ] Error handling is appropriate
- [ ] Performance considerations addressed

## Questions?

- Open an issue for bugs
- Start a discussion for features
- Join our community chat

Thank you for contributing!
