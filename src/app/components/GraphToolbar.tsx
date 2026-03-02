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
  bmrgData,
  onOpenHelp,
  userEmail,
  onLogout,
  onSignIn,
  canEdit,
  lockHolder,
  lockExpiresAt,
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

  const plausibleTransitionCount =
    bmrgData ? bmrgData.transitions.filter((t) => t.time_25 === 1).length : 0;

  return (
    <div className="controls-toolbar" data-tour="toolbar">
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
        className="button button-primary"
        disabled={editDisabled}
        title={editDisabled ? 'Model is locked by another user' : undefined}
      >
        Add Node
      </button>

      <button
        data-tour="create-edge"
        onClick={onToggleEdgeCreation}
        className={`button button-edge-creation ${edgeCreationMode ? 'active' : ''}`}
        disabled={editDisabled}
        title={editDisabled ? 'Model is locked by another user' : undefined}
      >
        {edgeCreationMode ? 'Cancel Edge Creation' : 'Create Edge'}
      </button>

      <button data-tour="load-all-edges" onClick={onLoadEdges} className="button button-secondary">
        Load All Edges
      </button>

      <button
        data-tour="save-model"
        onClick={() => {
          void onSaveModel().catch(() => undefined);
        }}
        disabled={isSaving || editDisabled}
        className={`button button-success ${isSaving ? 'button-disabled' : ''}`}
        title={editDisabled ? 'Model is locked by another user' : undefined}
      >
        {isSaving ? 'Saving...' : 'Save Model'}
      </button>

      {onOpenModelList && (
        <button data-tour="open-model" onClick={onOpenModelList} className="button button-secondary">
          Open Model
        </button>
      )}

      {onDeleteModel && (
        <button
          onClick={onDeleteModel}
          className="button button-danger"
          title="Delete this model (Admin only)"
          disabled={editDisabled}
        >
          Delete Model
        </button>
      )}

      <button
        data-tour="save-version"
        onClick={onSaveVersion}
        className="button button-secondary"
        disabled={editDisabled}
        title={editDisabled ? 'Model is locked by another user' : undefined}
      >
        Save Version
      </button>

      <button data-tour="versions" onClick={onOpenVersionManager} className="button button-secondary">
        Versions
      </button>

      <button data-tour="help" onClick={onOpenHelp} className="button button-secondary">
        Help
      </button>

      <button
        data-tour="import-eks"
        onClick={handleImportClick}
        className="button button-secondary"
        disabled={editDisabled}
        title={editDisabled ? 'Model is locked by another user' : undefined}
      >
        Import EKS
      </button>

      <button data-tour="export-eks" onClick={onExportEKS} className="button button-secondary">
        Export EKS
      </button>

      {onApplyLayout && (
        <div className="layout-inline">
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as LayoutStrategy)}
            className="button button-secondary select-like-btn"
            title="Layout"
            disabled={editDisabled}
          >
            <option value="layered">Layered (directed)</option>
            <option value="grid">Grid</option>
            <option value="force">Force-directed</option>
            <option value="heuristic">Heuristic (project)</option>
          </select>

          <button
            data-tour="apply-layout"
            onClick={() => {
              if (layout === 'heuristic') {
                onRelayout();
              } else if (onApplyLayout) {
                void onApplyLayout(layout);
              }
            }}
            className="button button-secondary"
            disabled={editDisabled}
            title={editDisabled ? 'Model is locked by another user' : undefined}
          >
            Apply Layout
          </button>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {userEmail ? (
        <>
          <span className="info-panel" style={{ padding: '8px 10px' }}>
            Signed in as {userEmail}
          </span>
          <button onClick={onLogout} className="button button-secondary">
            Logout
          </button>
        </>
      ) : (
        <>
          <span className="info-panel" style={{ padding: '8px 10px' }}>
            Guest mode
          </span>
          <button onClick={onSignIn} className="button button-primary">
            Sign in
          </button>
        </>
      )}

      <span className="info-panel" style={{ padding: '8px 10px' }}>
        {canEdit ? 'Edit lock acquired' : `Read-only${lockHolder ? `: ${lockHolder}` : ''}`}
        {lockExpiresAt ? ` (expires ${new Date(lockExpiresAt).toLocaleTimeString()})` : ''}
      </span>

      {!canEdit && onAcquireLock && (
        <button onClick={onAcquireLock} className="button button-primary">
          Request Edit Lock
        </button>
      )}

      {canEdit && onRefreshLock && (
        <button onClick={onRefreshLock} className="button button-secondary">
          Refresh Lock
        </button>
      )}

      {canEdit && onReleaseLock && (
        <button onClick={onReleaseLock} className="button button-secondary">
          Release Lock
        </button>
      )}

      <button
        onClick={onToggleSelfTransitions}
        className={`button ${showSelfTransitions ? 'button-info' : 'button-secondary'}`}
      >
        {showSelfTransitions ? 'Hide Self Transitions' : 'Show Self Transitions'}
      </button>

      {bmrgData && (
        <div className="info-panel">
          <strong>{bmrgData.stm_name}</strong>
          <span className="info-separator">|</span>
          <span>{bmrgData.states.length} states</span>
          <span className="info-separator">|</span>
          <span>
            {plausibleTransitionCount} plausible transitions
            <span className="info-text-muted"> (of {bmrgData.transitions.length} total)</span>
          </span>
        </div>
      )}
    </div>
  );
}
