import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  primaryAction?: { label: string; to?: string; onClick?: () => void };
  secondaryAction?: { label: string; to?: string; onClick?: () => void };
}

export function EmptyState({ icon, title, message, primaryAction, secondaryAction }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h2 className="empty-state-title">{title}</h2>
      {message && <p className="empty-state-message">{message}</p>}
      <div className="flex gap-2" style={{ justifyContent: 'center' }}>
        {primaryAction && renderAction(primaryAction, 'btn')}
        {secondaryAction && renderAction(secondaryAction, 'btn')}
      </div>
    </div>
  );
}

function renderAction(
  action: { label: string; to?: string; onClick?: () => void },
  className: string,
) {
  if (action.to) {
    return (
      <Link to={action.to} className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <button onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}
