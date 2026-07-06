import './Toast.css';

export default function Toast({ message, type = 'info', onDismiss }) {
  if (!message) return null;

  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      <div className="toast-content">{message}</div>
      {onDismiss && (
        <button className="toast-close" onClick={onDismiss} aria-label="Dismiss notification">×</button>
      )}
    </div>
  );
}
