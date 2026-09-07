import { Component } from 'react';

// Catches render/lifecycle errors anywhere below it in the tree. Without
// this, a single unhandled error in a page component (a bad API shape, a
// null-deref) would unmount the entire app to a blank white screen with no
// way back — this at least gives the user a way out and a place to see
// what happened, matching the app's own dark spec-sheet look rather than
// the browser's default error UI.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-base px-4">
        <div className="max-w-md text-center">
          <p className="font-mono text-5xl text-border mb-4">✕</p>
          <h1 className="font-display text-2xl font-semibold text-ink mb-3">Something went wrong</h1>
          <p className="text-muted text-sm mb-8">
            This page hit an unexpected error. Reloading usually fixes it — if it keeps happening, the cart and
            any saved builds are untouched on the server.
          </p>
          <button type="button" onClick={() => window.location.assign('/')} className="btn-primary">
            Back to home
          </button>
        </div>
      </div>
    );
  }
}
