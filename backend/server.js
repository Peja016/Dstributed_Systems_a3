// ------------------------------
// Backend Service
// ------------------------------
// Purpose: Simulate an unstable backend API.
// It sometimes responds slowly or returns errors,
// so that the client can test resilience behavior.

import express from "express"

const app = express()

// Configure error and delay probabilities via environment variables
const ERROR_RATE = parseFloat(process.env.ERROR_RATE || "0.1") // 10% chance of HTTP 500
const SLOW_RATE = parseFloat(process.env.SLOW_RATE || "0.2") // 20% chance of delay
const SLOW_MIN = parseFloat(process.env.SLOW_SECONDS_MIN || "2") // min delay in seconds
const SLOW_MAX = parseFloat(process.env.SLOW_SECONDS_MAX || "6") // max delay in seconds

// Health check endpoint (for docker-compose / monitoring)
app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

// Main data endpoint
app.get("/data", async (req, res) => {
  const r = Math.random()

  // Simulate server error with ERROR_RATE probability
  if (r < ERROR_RATE) {
    return res.status(500).json({ error: "Internal Server Error (simulated)" })
  }

  // Simulate slow response with SLOW_RATE probability
  if (r < ERROR_RATE + SLOW_RATE) {
    const delay = Math.random() * (SLOW_MAX - SLOW_MIN) + SLOW_MIN
    await new Promise((resolve) => setTimeout(resolve, delay * 1000)) // Sleep in ms
  }

  // Normal successful response
  res.json({
    message: "Hello from Backend!",
    note: "This endpoint randomly delays or fails for resilience testing",
  })
})

// Start the server
const PORT = process.env.PORT || 5001
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`))
