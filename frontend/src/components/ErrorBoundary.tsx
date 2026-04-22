import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
  /** Label shown on the reset button. Falls back to a neutral English. */
  resetLabel?: string;
  /** Headline shown in the error panel. */
  title?: string;
}

interface State {
  error: Error | null;
}

/**
 * Last-line-of-defense guard so a runtime exception in any route tree doesn't
 * blank the whole app. Not meant to catch network errors (RTK Query handles
 * those inline) — this is for render-time crashes that would otherwise leave
 * the user staring at a white page.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep console so devs see the stack; production logging hook could go here.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <Result
          status="error"
          title={this.props.title ?? 'Something went wrong'}
          subTitle={this.state.error.message}
          extra={
            <Button type="primary" onClick={this.reset}>
              {this.props.resetLabel ?? 'Try again'}
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
