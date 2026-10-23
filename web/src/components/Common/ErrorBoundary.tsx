import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  componentName: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught error in ${this.props.componentName}:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0f1d',
            color: '#f8fafc',
            padding: '20px',
            zIndex: 50,
          }}
        >
          <div
            className="tactical-panel"
            style={{
              padding: '24px 32px',
              maxWidth: '500px',
              textAlign: 'center',
              border: '1px solid #ef4444',
              borderRadius: '8px',
            }}
          >
            <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>
              Chyba komponenty: {this.props.componentName}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '16px' }}>
              {this.state.error?.message || 'Nastala neočekávaná chyba při vykreslování.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: '#38bdf8',
                color: '#0a0f1d',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={16} /> Obnovit zobrazení
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
