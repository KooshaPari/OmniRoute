# Kwality Demonstrations

This directory contains VHS tape files and generated GIF demonstrations showcasing Kwality's capabilities.

## 🎬 Available Demonstrations

### 1. Basic Validation (`basic-validation.tape`)
- **Output**: `kwality-basic-validation.gif`
- **Shows**: Complete validation workflow for an AI-generated codebase
- **Features**: Basic validation, status checks, detailed reporting

### 2. Installation Process (`installation.tape`)
- **Output**: `kwality-installation.gif`
- **Shows**: Step-by-step installation from prerequisites to first validation
- **Features**: Dependency checks, building, installation, verification

### 3. Security Scanning (`security-scan.tape`)
- **Output**: `kwality-security-scan.gif`
- **Shows**: Comprehensive security scanning capabilities
- **Features**: Vulnerability detection, compliance checks, secrets scanning

### 4. API Usage (`api-usage.tape`)
- **Output**: `kwality-api-usage.gif`
- **Shows**: REST API integration and endpoints
- **Features**: Server startup, API calls, validation submission, metrics

### 5. Production Deployment (`deployment.tape`)
- **Output**: `kwality-deployment.gif`
- **Shows**: Production deployment with Docker and Kubernetes
- **Features**: Secret generation, Docker Compose, scaling, health checks

## 🛠️ Prerequisites

1. **VHS (Video Hypertext Syntax)** - Terminal recording tool
   ```bash
   # Install VHS
   brew install vhs
   # or
   go install github.com/charmbracelet/vhs@latest
   ```

2. **Kwality Binary** - Built and available in project root
   ```bash
   make build
   ```

3. **Docker** - For deployment demonstrations
   ```bash
   docker --version
   ```

## 🎯 Generating Demonstrations

### Generate All Demos
```bash
# Run the master script to generate all GIFs
./demos/generate-demos.sh
```

### Generate Individual Demos
```bash
# Basic validation demo
vhs demos/basic-validation.tape

# Installation demo
vhs demos/installation.tape

# Security scanning demo
vhs demos/security-scan.tape

# API usage demo
vhs demos/api-usage.tape

# Deployment demo
vhs demos/deployment.tape
```

## 📁 Output Files

Generated GIF files will be placed in the `demos/` directory:
- `kwality-basic-validation.gif`
- `kwality-installation.gif`
- `kwality-security-scan.gif`
- `kwality-api-usage.gif`
- `kwality-deployment.gif`

## 🎨 VHS Configuration

All tape files use consistent styling:
- **Font Size**: 14px
- **Dimensions**: 1400x900
- **Theme**: Molokai (dark theme)
- **Timing**: Optimized for readability

## 📝 Customization

To customize demonstrations:

1. **Edit tape files** to modify commands or timing
2. **Adjust VHS settings** (font size, theme, dimensions) in tape headers
3. **Add new demonstrations** by creating new `.tape` files
4. **Update the generation script** to include new demos

## 🔄 Maintenance

### Updating Demonstrations
When Kwality features change:
1. Update relevant `.tape` files
2. Regenerate affected GIFs
3. Verify new demonstrations work correctly

### Adding New Demonstrations
1. Create new `.tape` file
2. Add generation command to `generate-demos.sh`
3. Update this README with new demo description
4. Reference new GIF in main README.md

## 📖 VHS Documentation

For more information about VHS tape syntax:
- [VHS GitHub Repository](https://github.com/charmbracelet/vhs)
- [VHS Documentation](https://github.com/charmbracelet/vhs/blob/main/README.md)

## 🎯 Integration with README

These demonstrations are embedded throughout the main README.md file:
- **Basic Validation**: Platform Demo section
- **Installation**: Quick Start section
- **Security Scanning**: Security Features section
- **API Usage**: API Reference section
- **Deployment**: Deployment section

This provides users with visual understanding of Kwality's capabilities at relevant points in the documentation.