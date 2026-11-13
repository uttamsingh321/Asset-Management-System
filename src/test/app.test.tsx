import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'
import { initialAssets } from '../data/mockAssets'

describe('Asset Management System Core Compliance', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('Rule 1: Starts with zero dummy data', () => {
    expect(initialAssets).toHaveLength(0)
    render(<App />)
    expect(screen.getByText(/Across 0 registered assets/i)).toBeInTheDocument()
    expect(screen.getByText(/Your inventory register is currently empty/i)).toBeInTheDocument()
  })

  it('Rule 2: Render completes in under 100ms', () => {
    const start = performance.now()
    render(<App />)
    const duration = performance.now() - start
    expect(duration).toBeLessThan(100)
  })
})
