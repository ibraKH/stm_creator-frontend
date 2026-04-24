import React from 'react';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 24, 40, 0.55)',
          backdropFilter: 'blur(3px)',
          zIndex: 1200,
          animation: 'cmFadeIn 0.18s ease-out',
        }}
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1201,
          width: '100%',
          maxWidth: 460,
          padding: '0 16px',
          animation: 'cmScaleIn 0.2s ease-out',
        }}
      >
        <div style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #eaecf0',
          boxShadow: '0 20px 60px rgba(16, 24, 40, 0.18), 0 4px 12px rgba(16, 24, 40, 0.08)',
          overflow: 'hidden',
        }}>

          {/* Icon + Title */}
          <div style={{ padding: '24px 24px 0' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: isDanger ? '#fff1f3' : '#fffaeb',
              border: `1px solid ${isDanger ? '#fecdd6' : '#fedf89'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}>
              {isDanger ? <TrashIcon color="#c01048" /> : <AlertIcon color="#b54708" />}
            </div>

            <h2
              id="confirm-modal-title"
              style={{
                margin: '0 0 8px',
                fontSize: 18,
                fontWeight: 700,
                color: '#101828',
                letterSpacing: '-0.01em',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {title}
            </h2>

            <p style={{
              margin: 0,
              fontSize: 14,
              color: '#475467',
              lineHeight: 1.6,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              {description}
            </p>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: 10,
            padding: '24px',
            justifyContent: 'flex-end',
          }}>
            <button
              onClick={onCancel}
              style={{
                padding: '9px 18px',
                background: '#ffffff',
                color: '#344054',
                border: '1px solid #eaecf0',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'inherit',
                boxShadow: '0 1px 2px 0 rgba(16, 24, 40, 0.05)',
                transition: 'background 0.1s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
            >
              {cancelLabel}
            </button>

            <button
              onClick={onConfirm}
              style={{
                padding: '9px 18px',
                background: isDanger ? '#c01048' : '#b54708',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'inherit',
                boxShadow: `0 1px 2px 0 rgba(16, 24, 40, 0.05)`,
                transition: 'opacity 0.1s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Keyframes — injected once */}
      <style>{`
        @keyframes cmFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cmScaleIn { from { opacity: 0; transform: translate(-50%, -48%) scale(0.96) } to { opacity: 1; transform: translate(-50%, -50%) scale(1) } }
      `}</style>
    </>
  );
}

function TrashIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function AlertIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
