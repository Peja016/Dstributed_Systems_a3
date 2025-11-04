// ------------------------------
// Client Service with and without Circuit Breaker
// ------------------------------

import express from "express"
import axios from "axios"
import CircuitBreaker from "opossum"

const app = express()

// === Configuration ===
const BACKEND_HOST = process.env.BACKEND_HOST || "backend"
const BACKEND_PORT = process.env.BACKEND_PORT || "5001"
const TIMEOUT_MS = parseFloat(process.env.TIMEOUT_MS || "3000")
const backendUrl = `http://${BACKEND_HOST}:${BACKEND_PORT}/data`

// ------------------------------
// 1. BASELINE MODE (Part A)
// ------------------------------

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

// Single request - Baseline (no circuit breaker)
app.get("/fetch", async (req, res) => {
  const start = Date.now()
  try {
    const resp = await axios.get(backendUrl, { timeout: TIMEOUT_MS })
    res.status(resp.status).json({
      backendUrl,
      status: resp.status,
      elapsed_ms: Date.now() - start,
      payload: resp.data,
    })
  } catch (err) {
    res.status(502).json({
      backendUrl,
      error: err.code || "RequestFailed",
      elapsed_ms: Date.now() - start,
    })
  }
})

// Multiple requests - Baseline
app.get("/loop", async (req, res) => {
  const n = parseInt(req.query.n || "10")
  const results = []

  for (let i = 0; i < n; i++) {
    const start = Date.now()
    try {
      const resp = await axios.get(backendUrl, { timeout: TIMEOUT_MS })
      results.push({
        i,
        status: resp.status,
        elapsed_ms: Date.now() - start,
      })
    } catch (err) {
      results.push({
        i,
        error: err.code || "RequestFailed",
        elapsed_ms: Date.now() - start,
      })
    }
  }

  res.json({ mode: "baseline", count: n, backendUrl, results })
})

// ------------------------------
// 2. CIRCUIT BREAKER MODE (Part B)
// ------------------------------

// Define backend call function (to be protected by breaker)
async function fetchFromBackend() {
  const res = await axios.get(backendUrl, { timeout: TIMEOUT_MS })
  return res.data
}

// Configure circuit breaker
const breakerOptions = {
  timeout: TIMEOUT_MS, // fail after 3s timeout
  errorThresholdPercentage: 50, // open circuit when 50% fail
  resetTimeout: 5000, // try half-open after 5s
}

const breaker = new CircuitBreaker(fetchFromBackend, breakerOptions)

// Log state transitions
breaker.on("open", () => console.log("Circuit is OPEN – requests are blocked"))
breaker.on("halfOpen", () =>
  console.log("Circuit is HALF-OPEN – testing limited requests")
)
breaker.on("close", () => console.log("Circuit is CLOSED – system recovered"))

// Single request - with Circuit Breaker
app.get("/fetchBreaker", async (req, res) => {
  const start = Date.now()
  try {
    const result = await breaker.fire()
    res.json({
      mode: "breaker",
      backendUrl,
      status: "OK",
      elapsed_ms: Date.now() - start,
      payload: result,
    })
  } catch (err) {
    res.status(502).json({
      mode: "breaker",
      backendUrl,
      error: err.message || err.code || "RequestFailed",
      elapsed_ms: Date.now() - start,
    })
  }
})

// Multiple requests - with Circuit Breaker
app.get("/loopBreaker", async (req, res) => {
  const n = parseInt(req.query.n || "10")
  const results = []

  for (let i = 0; i < n; i++) {
    const start = Date.now()
    try {
      const result = await breaker.fire()
      results.push({
        i,
        status: "OK",
        elapsed_ms: Date.now() - start,
      })
    } catch (err) {
      results.push({
        i,
        status: "FAILED",
        error: err.message || err.code,
        elapsed_ms: Date.now() - start,
      })
    }
  }

  res.json({ mode: "breaker", count: n, backendUrl, results })
})

// Single request - Retry pattern
app.get("/fetchRetry", async (req, res) => {
  const maxRetries = 5
  const baseDelay = 500 // ms
  const jitter = 200 // ms
  const start = Date.now()

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resp = await axios.get(backendUrl, { timeout: TIMEOUT_MS })
      return res.json({
        attempt,
        backendUrl,
        status: resp.status,
        elapsed_ms: Date.now() - start,
        payload: resp.data,
      })
    } catch (err) {
      if (attempt === maxRetries) {
        return res.status(502).json({
          backendUrl,
          error: `Failed after ${attempt} retries`,
          elapsed_ms: Date.now() - start,
        })
      }
      // Calculate exponential delay + jitter
      const delay =
        baseDelay * Math.pow(2, attempt - 1) + Math.random() * jitter
      console.log(
        `Attempt ${attempt} failed: ${
          err.code || err.message
        }. Retrying in ${delay.toFixed(0)}ms`
      )
      await new Promise((r) => setTimeout(r, delay))
    }
  }
})

// Multiple requests - Retry pattern
app.get("/loopRetry", async (req, res) => {
  const n = parseInt(req.query.n || "10")
  const maxRetries = 5
  const baseDelay = 500 // ms
  const jitter = 200 // ms
  const results = []

  for (let i = 0; i < n; i++) {
    const start = Date.now()
    let success = false
    let attempt = 0

    while (attempt < maxRetries && !success) {
      attempt++
      try {
        const resp = await axios.get(backendUrl, { timeout: TIMEOUT_MS })
        results.push({
          i,
          attempt,
          status: resp.status,
          elapsed_ms: Date.now() - start,
        })
        success = true
      } catch (err) {
        if (attempt === maxRetries) {
          results.push({
            i,
            attempt,
            error: err.code || err.message,
            elapsed_ms: Date.now() - start,
          })
        } else {
          const delay =
            baseDelay * Math.pow(2, attempt - 1) + Math.random() * jitter
          console.log(
            `Request ${i}, Attempt ${attempt} failed: ${
              err.code || err.message
            }. Retrying in ${delay.toFixed(0)}ms`
          )
          await new Promise((r) => setTimeout(r, delay))
        }
      }
    }
  }

  res.json({ mode: "retry", count: n, backendUrl, results })
})

// ------------------------------
// Start server
// ------------------------------
const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`ClientService running on port ${PORT}`))
