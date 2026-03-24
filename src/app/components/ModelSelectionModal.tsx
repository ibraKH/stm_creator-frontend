import { useState, useEffect } from 'react';
import { API_BASE, getAuthHeader } from '../auth/api';

interface Props {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onCreateNew: (modelName: string) => void;
  readonly onLoadExisting: (modelName: string) => void;
}

export function ModelSelectionModal({ isOpen, onClose, onCreateNew, onLoadExisting }: Props) {
  const [modelName, setModelName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const fetchModels = async () => {
      setListLoading(true);
      setListError(null);
      try {
        const res = await fetch(`${API_BASE}/models/all`, {
          headers: { 'Accept': 'application/json', ...getAuthHeader() },
        });
        if (res.status === 401 || res.status === 403) {
          setListError('Requires Admin privileges to list models.');
          setModels([]);
          return;
        }
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `Failed to fetch models (${res.status})`);
        }
        const data = (await res.json()) as unknown;
        const arr = Array.isArray(data) ? data.filter((x) => typeof x === 'string') as string[] : [];
        if (!cancelled) setModels(arr);
      } catch (e) {
        if (!cancelled) setListError((e as Error).message || 'Failed to fetch models');
      } finally {
        if (!cancelled) setListLoading(false);
      }
    };
    void fetchModels();
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleCreateNew = () => {
    if (!modelName.trim()) {
      setError('Please enter a model name');
      return;
    }
    onCreateNew(modelName.trim());
    setModelName('');
    setError(null);
  };

  const handleClose = () => {
    setModelName('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={overlay} onClick={handleClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()} aria-labelledby="model-selection-title">
        {/* Header */}
        <div style={header}>
          <h2 id="model-selection-title" style={titleStyle}>Select Model</h2>
          <button onClick={handleClose} style={closeBtn} aria-label="Close">✖</button>
        </div>

        {/* Existing Models List */}
        <div style={sectionBox}>
          <h3 style={sectionTitle}>Existing Models</h3>
          {listLoading ? (
            <p style={infoText}>Loading models…</p>
          ) : listError ? (
            <div style={errorBoxStyle}>{listError}</div>
          ) : models.length === 0 ? (
            <p style={infoText}>No models found.</p>
          ) : (
            <ul style={listContainer}>
              {models.map((name) => (
                <li key={name}>
                  <button
                    onClick={() => {
                      onLoadExisting(name);
                      setModelName('');
                      setError(null);
                    }}
                    style={modelItemBtn}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f0fdf4';
                      e.currentTarget.style.borderColor = '#86efac';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }}
                  >
                    <span style={modelIcon}>📄</span>
                    <span>{name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Divider */}
        <div style={divider}>
          <span style={dividerLine} />
          <span style={dividerText}>OR CREATE NEW</span>
          <span style={dividerLine} />
        </div>

        {/* Create New Model */}
        <div style={createSection}>
          <div style={createRow}>
            <input
              type="text"
              value={modelName}
              onChange={(e) => { setModelName(e.target.value); setError(null); }}
              placeholder="Enter new model name…"
              style={inputStyle}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNew(); }}
            />
            <button onClick={handleCreateNew} style={createBtn}>
              Create
            </button>
          </div>
          {error && <div style={inputError}>{error}</div>}
        </div>
      </div>
    </div>
  );
}

/* ── Styles ── */

const overlay: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1200,
};

const modal: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: 28,
  width: 520,
  maxWidth: '92%',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
};

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 600,
  color: '#064e3b',
};

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 18,
  cursor: 'pointer',
  color: '#065f46',
  padding: 4,
};

const sectionBox: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 12px 0',
  fontSize: 14,
  fontWeight: 600,
  color: '#065f46',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const infoText: React.CSSProperties = {
  color: '#6b7280',
  fontSize: 14,
  margin: '8px 0',
};

const errorBoxStyle: React.CSSProperties = {
  padding: 10,
  background: 'rgba(239, 68, 68, 0.08)',
  color: '#dc2626',
  borderRadius: 6,
  fontSize: 13,
  border: '1px solid #fca5a5',
};

const listContainer: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: 6,
  maxHeight: 280,
  overflowY: 'auto',
};

const modelItemBtn: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  color: '#064e3b',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  transition: 'all 0.15s',
};

const modelIcon: React.CSSProperties = {
  fontSize: 16,
  flexShrink: 0,
};

const divider: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  margin: '20px 0',
};

const dividerLine: React.CSSProperties = {
  flex: 1,
  height: 1,
  background: 'linear-gradient(90deg, rgba(205,174,107,0.0), rgba(205,174,107,0.5), rgba(205,174,107,0.0))',
};

const dividerText: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#9ca3af',
  letterSpacing: '1px',
};

const createSection: React.CSSProperties = {};

const createRow: React.CSSProperties = {
  display: 'flex',
  gap: 10,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #F0D9A6',
  background: '#fff',
  color: '#065f46',
  outline: 'none',
  fontSize: 14,
};

const createBtn: React.CSSProperties = {
  padding: '10px 20px',
  background: 'linear-gradient(135deg, #10b981, #059669)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const inputError: React.CSSProperties = {
  marginTop: 8,
  padding: 8,
  background: 'rgba(239, 68, 68, 0.1)',
  color: '#dc2626',
  borderRadius: 6,
  fontSize: 12,
};
