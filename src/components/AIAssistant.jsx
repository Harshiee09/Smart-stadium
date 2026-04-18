/**
 * AIAssistant.jsx
 * Bottom chat bar — powered by Gemini AI or local fallback
 */

import React from 'react'
import { useState, useRef } from 'react'
import { queryStadiumAI } from '../services/geminiService'

export default function AIAssistant({ state }) {
  const [input, setInput] = useState('')
  const [response, setResponse] = useState('Ready. Ask me about: gate queues, best food, parking, exit routes, crowd, or match.')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  async function ask() {
    const q = input.trim()
    if (!q) return
    setInput('')
    setLoading(true)
    setResponse('⬡ Analysing...')
    try {
      const answer = await queryStadiumAI(q, state)
      setResponse(answer)
    } catch {
      setResponse('⬡ System busy — please retry.')
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') ask()
  }

  const suggestions = ['exit strategy', 'best food now', 'parking P1', 'gate C load', 'best view']

  return (
    <div className="ai-panel" role="complementary" aria-label="AI Stadium Assistant">
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--accent2)', marginBottom: 5 }}>
        ⬡ AI STADIUM ASSISTANT
        <span style={{ fontFamily: "'Share Tech Mono'", fontSize: 9, color: 'var(--text3)', marginLeft: 8, letterSpacing: 0 }}>
          Gemini 1.5 Flash · Local fallback active
        </span>
      </div>
      <div className="ai-input-row">
        <input
          ref={inputRef}
          className="ai-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask: best route, food queue, parking, exit strategy..."
          disabled={loading}
          aria-label="Ask the stadium AI assistant"
        />
        <button
          className="ai-btn"
          onClick={ask}
          disabled={loading}
          aria-label="Send question"
        >
          {loading ? '...' : 'ASK'}
        </button>
      </div>

      {/* Quick suggestions */}
      <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
        {suggestions.map(s => (
          <button
            key={s}
            onClick={() => { setInput(s); setTimeout(ask, 50) }}
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              color: 'var(--text2)', borderRadius: 2, padding: '2px 7px',
              fontFamily: "'Share Tech Mono'", fontSize: 9, cursor: 'pointer',
            }}
            aria-label={`Quick question: ${s}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div
        className="ai-response"
        role="status"
        aria-live="polite"
        aria-label="AI response"
      >
        {response}
      </div>
    </div>
  )
}
