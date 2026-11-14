import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

window.scrollTo = () => {}

beforeEach(() => {
  sessionStorage.setItem('meridian_auth', 'true')
  sessionStorage.setItem('meridian_active_factory', 'Noida Plant (SMT Line & Assembly)')
})
