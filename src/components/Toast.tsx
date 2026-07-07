interface ToastProps {
  message: string;
  variant: 'success' | 'error';
  onDismiss: () => void;
}

export default function Toast({ message, variant, onDismiss }: ToastProps) {
  return (
    <div className={`toast ${variant}`} role="status">
      <span className="toast-message">{message}</span>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label="关闭">
        ×
      </button>
    </div>
  );
}
