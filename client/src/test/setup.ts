import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL's auto-cleanup relies on a global `afterEach`, which doesn't exist here —
// this project keeps explicit `vitest` imports (test.globals: false) to match
// the server's convention, so cleanup has to be registered explicitly instead.
afterEach(() => {
  cleanup()
})
