#!/bin/bash
# Start the FastAPI backend server
cd "$(dirname "$0")/backend"
echo "Starting DermAI Backend on http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
