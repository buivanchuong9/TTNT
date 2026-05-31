#!/bin/bash
# Start the React frontend dev server
cd "$(dirname "$0")/frontend"
echo "Starting DermAI Frontend on http://localhost:5173"
echo ""
npm run dev
