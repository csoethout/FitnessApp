import { useRouteError } from 'react-router'
import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * If a screen crashes, show the error with Reload / Reset instead of a blank screen (React removes everything
 * on an uncaught render error). Reset = the boot-help "Reset app" in index.html: fresh app files, data kept.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const w = window as Window & { __showBootHelp?: (msg: string) => void }
    w.__showBootHelp?.(`${this.state.error.message}\n${this.state.error.stack ?? ''}`)
    return null
  }
}

/** Same help screen for errors React Router catches inside a route (it doesn't pass them to ErrorBoundary). */
export function RouteError() {
  const error = useRouteError()
  const w = window as Window & { __showBootHelp?: (msg: string) => void }
  const msg = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : JSON.stringify(error)
  w.__showBootHelp?.(msg)
  return null
}
