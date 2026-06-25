import { Component, type ErrorInfo, type ReactNode } from 'react'

import i18n from '@/i18n/i18n'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-semibold">{i18n.t('errors.boundary.title')}</h1>
          <p className="text-muted-foreground max-w-md text-sm">
            {i18n.t('errors.boundary.message')}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => this.setState({ hasError: false })}>
              {i18n.t('errors.boundary.tryAgain')}
            </Button>
            <Button asChild>
              <a href="/">{i18n.t('errors.boundary.goHome')}</a>
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
