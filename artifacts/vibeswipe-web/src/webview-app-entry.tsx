import { ErrorBoundary } from '@/components/error-boundary';
import App from './App';

import './index.css';

export default function WebViewAppEntry() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
