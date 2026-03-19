import { useRef, useState } from 'react';

import { BMRGData } from '../../utils/stateTransition';
import type { SaveModelResponse } from '../hooks/graphModel';
import type { LayoutStrategy } from '../../utils/layoutStrategies';

interface GraphToolbarProps {
  readonly onAddNode: () => void;
  readonly onToggleEdgeCreation: () => void;
  readonly onLoadEdges: () => void;
  readonly onSaveModel: () => Promise<SaveModelResponse>;
  readonly onOpenModelList?: () => void;
  readonly onDeleteModel?: () => void;
  readonly onSaveVersion: () => void;
  readonly onOpenVersionManager: () => void;
  readonly onImportEKS: (file: File) => void | Promise<void>;
  readonly onExportEKS: () => void;
  readonly onRelayout: () => void;
  readonly onApplyLayout?: (strategy: LayoutStrategy) => void | Promise<void>;
  readonly onToggleSelfTransitions: () => void;
  readonly edgeCreationMode: boolean;
  readonly isSaving: boolean;
  readonly showSelfTransitions: boolean;
  readonly bmrgData: BMRGData | null;
  readonly onOpenHelp: () => void;
  readonly userEmail?: string | null;
  readonly isGuest?: boolean;
  readonly onLogout?: () => void;
  readonly onSignIn?: () => void;
  readonly canEdit: boolean;
  readonly lockHolder?: string | null;
  readonly lockExpiresAt?: string | null;
  readonly onAcquireLock?: () => void;
  readonly onReleaseLock?: () => void;
  readonly onRefreshLock?: () => void;
}

export function GraphToolbar({
  onAddNode,
  onToggleEdgeCreation,
  onLoadEdges,
  onSaveModel,
  onOpenModelList,
  onDeleteModel,
  onRelayout,
  onApplyLayout,
  onSaveVersion,
  onOpenVersionManager,
  onImportEKS,
  onExportEKS,
  onToggleSelfTransitions,
  edgeCreationMode,
  isSaving,
  showSelfTransitions,
  onOpenHelp,
  userEmail,
  onLogout,
  onSignIn,
  canEdit,
  onAcquireLock,
  onReleaseLock,
  onRefreshLock,
}: GraphToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [layout, setLayout] = useState<LayoutStrategy>('force');
  const editDisabled = !canEdit;

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportEKS(file);
    }
    event.target.value = '';
  };

  return (
    <div className="toolbar">
      <span className="toolbar-logo">STM</span>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <button
        data-tour="add-node"
        onClick={onAddNode}
        className="tb-btn primary"
        disabled={editDisabled}
      >
        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z"/></svg>
        Add Node
      </button>

      <button
        data-tour="create-edge"
        onClick={onToggleEdgeCreation}
        className={`tb-btn ${edgeCreationMode ? 'active' : ''}`}
        disabled={editDisabled}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8h12M8 2v12"/><circle cx="8" cy="8" r="2"/></svg>
        {edgeCreationMode ? 'Cancel Edge' : 'Create Edge'}
      </button>

      <button data-tour="load-all-edges" onClick={onLoadEdges} className="tb-btn">
        Load All Edges
      </button>

      <div className="tb-sep" />

      <button
        data-tour="save-model"
        onClick={() => {
          void onSaveModel().catch(() => undefined);
        }}
        disabled={isSaving || editDisabled}
        className="tb-btn"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12V4l4 4 3-3 5 5"/></svg>
        {isSaving ? 'Saving...' : 'Save Model'}
      </button>

      <button
        data-tour="save-version"
        onClick={onSaveVersion}
        className="tb-btn"
        disabled={editDisabled}
      >
        Save Version
      </button>

      <button data-tour="versions" onClick={onOpenVersionManager} className="tb-btn">
        Versions
      </button>

      <div className="tb-sep" />

      <button
        data-tour="import-eks"
        onClick={handleImportClick}
        className="tb-btn"
        disabled={editDisabled}
      >
        Import EKS
      </button>

      <button data-tour="export-eks" onClick={onExportEKS} className="tb-btn">
        Export EKS
      </button>

      {onApplyLayout && (
        <>
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as LayoutStrategy)}
            className="tb-btn"
            style={{ paddingRight: 24, appearance: 'auto' as any }}
            disabled={editDisabled}
          >
            <option value="layered">Layered</option>
            <option value="grid">Grid</option>
            <option value="force">Force</option>
            <option value="heuristic">Heuristic</option>
          </select>
          <button
            data-tour="apply-layout"
            onClick={() => {
              if (layout === 'heuristic') {
                onRelayout();
              } else {
                void onApplyLayout(layout);
              }
            }}
            className="tb-btn"
            disabled={editDisabled}
          >
            Re-layout
          </button>
        </>
      )}

      <div className="tb-sep" />

      <button
        onClick={onToggleSelfTransitions}
        className={`tb-btn ${showSelfTransitions ? 'active' : ''}`}
      >
        {showSelfTransitions ? 'Hide Self-Trans' : 'Show Self-Trans'}
      </button>

      {onOpenModelList && (
        <button data-tour="open-model" onClick={onOpenModelList} className="tb-btn">
          Open Model
        </button>
      )}

      {onDeleteModel && (
        <button onClick={onDeleteModel} className="tb-btn" disabled={editDisabled} style={{ color: 'var(--red)' }}>
          Delete
        </button>
      )}

      <div className="tb-spacer" />

      {/* Lock controls */}
      {!canEdit && onAcquireLock && (
        <button onClick={onAcquireLock} className="tb-btn primary">
          Request Lock
        </button>
      )}

      {canEdit && onRefreshLock && (
        <button onClick={onRefreshLock} className="tb-btn">Refresh Lock</button>
      )}

      {canEdit && onReleaseLock && (
        <button onClick={onReleaseLock} className="tb-btn">Release Lock</button>
      )}

      <div className="tb-sep" />

      {/* Auth */}
      {userEmail ? (
        <button onClick={onLogout} className="tb-btn">Logout</button>
      ) : (
        <button onClick={onSignIn} className="tb-btn primary">Sign in</button>
      )}

      <button data-tour="help" onClick={onOpenHelp} className="tb-btn">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5.5v.5"/></svg>
        Help
      </button>
    </div>
  );
}
