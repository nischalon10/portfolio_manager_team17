#!/bin/bash

# Portfolio Manager Startup Script

echo "🚀 Starting Portfolio Manager Full Stack Application"
echo "=================================================="

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use. Please stop the service using that port."
        return 1
    fi
    return 0
}

# Check if required ports are available
echo "🔍 Checking port availability..."
check_port 5001 || exit 1
check_port 3000 || exit 1

echo "✅ Ports are available"

# Start backend
echo "🔧 Starting Flask backend on port 5001..."
cd backend
python3 app.py &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "⚛️  Starting React frontend on port 3000..."
cd ../frontend
npm start &
FRONTEND_PID=$!

echo ""
echo "🎉 Both servers are starting up!"
echo "📱 Frontend: http://localhost:3000"
echo "🔌 Backend API: http://localhost:5001"
echo ""
echo "To stop both servers, press Ctrl+C or run:"
echo "kill $BACKEND_PID $FRONTEND_PID"

# Wait for user to stop
wait
