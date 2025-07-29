#!/bin/bash
# Activation script for Portfolio Manager project
# Usage: source activate.sh

echo "Activating Portfolio Manager virtual environment..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Creating one..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

echo "Virtual environment activated!"
echo "Python location: $(which python)"
echo "Python version: $(python --version)"
echo ""
echo "Available commands:"
echo "  python create_database.py    - Create and populate database"
echo "  python verify_database.py    - Verify database structure"
echo "  deactivate                   - Exit virtual environment"
echo ""
