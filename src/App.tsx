import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import '@xyflow/react/dist/style.css';
import './EdgeStyles.css';
import './SwimlaneStyle.css';
import './App.css';

import { GraphToolbar } from './app/components/GraphToolbar';
import { EdgeCreationHint } from './app/components/EdgeCreationHint';
import { ErrorState } from './app/components/ErrorState';
import { LoadingState } from './app/components/LoadingState';
import { TipsPanel } from './app/components/TipsPanel';
import { VersionManagerModal } from './app/components/VersionManagerModal';
import { ModelListModal } from './app/components/ModelListModal';
import { HelpModal } from './app/components/HelpModal';
import { useGraphEditor } from './app/hooks/useGraphEditor';
import { NodeModal } from './nodes/nodeModal';
import { TransitionModal } from './transitions/transitionModal';

import { TransitionFilterPanel } from './extensions/TransitionFilterPanel';
import './extensions/extensions.css';

import AuthPage from './app/auth/AuthPage';
import { authStorage, type AuthUser } from './app/auth/api';
import {
  acquireModelLock,
  getModelLock,
  releaseModelLock,
  renewModelLock,
  type ModelLockInfo,
} from './app/api/locks';
import { connectCollabSocket, disconnectCollabSocket } from './collab/socket';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

import { Tour } from './extensions/onboarding/Tour';
import { coachSteps } from './extensions/onboarding/coachmarks';
import { useOnboarding } from './extensions/onboarding/useOnboarding';

type LockState = {
  canEdit: boolean;
  lockId: string | null;
  holder: string | null;
  expiresAt: string | null;
};

function applyLockInfo(info: ModelLockInfo): LockState {
  const owner = info.owner ?? Boolean(info.lockId);
  return {
    canEdit: owner,
    lockId: owner ? info.lockId ?? null : null,
    holder: info.lockedBy ?? null,
    expiresAt: info.expiresAt ?? null,
  };
}

function GraphEditor() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isModelListOpen, setIsModelListOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(true);

  const [auth, setAuth] = useState<{ token: string; user: AuthUser } | null>(() => {
    const token = authStorage.getToken();
    const user = authStorage.getUser();
    return token && user ? { token, user } : null;
  });
  const [isGuest, setIsGuest] = useState(false);

  const [lockState, setLockState] = useState<LockState>({
    canEdit: false,
    lockId: null,
    holder: null,
    expiresAt: null,
  });
  const lockRef = useRef<{ modelName: string | null; lockId: string | null }>({
    modelName: null,
    lockId: null,
  });

  const onboarding = useOnboarding();

  const [tourOpen, setTourOpen] = useState<boolean>(false);
  const closeTour = () => {
    setTourOpen(false);
    onboarding.complete();
  };

  const {
    nodesWithCallbacks,
    edges,
    nodeTypes,
    customEdgeTypes,
    defaultEdgeOptions,
    bmrgData,
    isLoading,
    error,
    isSaving,
    edgeCreationMode,
    startNodeId,
    showSelfTransitions,
    deltaFilter,
    isNodeModalOpen,
    isTransitionModalOpen,
    isEditing,
    initialNodeValues,
    currentTransition,
    stateNameMap,
    versions,
    isVersionModalOpen,
    onNodesChange,
    onConnect,
    onEdgeClick,
    onEdgeDoubleClick,
    handleEdgesChange,
    handleSaveNode,
    handleSaveTransition,
    handleDeleteTransition,
    handleSaveModel,
    handleDeleteState,
    handleDeleteModel,
    handleReLayout,
    applyLayout,
    toggleEdgeCreationMode,
    loadExistingEdges,
    toggleSelfTransitions,
    toggleDeltaFilter,
    openAddNodeModal,
    closeNodeModal,
    closeTransitionModal,
    saveCurrentVersion,
    openVersionManager,
    closeVersionManager,
    restoreVersion,
    deleteVersion,
    exportToEKS,
    importFromEKS,
  } = useGraphEditor({
    canEdit: lockState.canEdit,
    onReadOnlyAction: () => {
      window.alert('Model is locked by another user. You currently have read-only access.');
    },
  });

  const modelName = bmrgData?.stm_name?.trim() || null;

  const releaseCurrentLock = async () => {
    const currentModel = lockRef.current.modelName;
    const currentLockId = lockRef.current.lockId;
    if (!currentModel || !currentLockId) {
      return;
    }
    try {
      await releaseModelLock(currentModel, currentLockId);
    } catch {
      // ignore release failure on unload/logout
    }
    lockRef.current = { modelName: currentModel, lockId: null };
    setLockState((prev) => ({ ...prev, canEdit: false, lockId: null }));
  };

  const handleAcquireLock = async () => {
    if (!modelName) {
      return;
    }
    if (!auth?.token) {
      window.alert('Please sign in to request edit lock.');
      return;
    }

    try {
      const info = await acquireModelLock(modelName);
      const next = applyLockInfo(info);
      setLockState(next);
      lockRef.current = { modelName, lockId: next.lockId };
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : 'Unable to acquire lock.';
      try {
        const status = await getModelLock(modelName);
        const next = applyLockInfo(status);
        setLockState(next);
      } catch {
        setLockState({ canEdit: false, lockId: null, holder: null, expiresAt: null });
      }
      window.alert(message);
    }
  };

  const handleRefreshLock = async () => {
    if (!modelName || !lockState.lockId) {
      return;
    }
    try {
      const info = await renewModelLock(modelName, lockState.lockId);
      const next = applyLockInfo(info);
      setLockState(next);
      lockRef.current = { modelName, lockId: next.lockId };
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : 'Failed to refresh lock.';
      setLockState((prev) => ({ ...prev, canEdit: false, lockId: null }));
      lockRef.current = { modelName, lockId: null };
      window.alert(message);
    }
  };

  const handleReleaseLock = async () => {
    await releaseCurrentLock();
  };

  // Onboarding tour auto-start disabled — keep code for manual replay via Help
  // useEffect(() => {
  //   if (!(auth || isGuest)) return;
  //   if (isLoading) return;
  //   if (onboarding.finished) return;
  //   const id1 = requestAnimationFrame(() => {
  //     const id2 = requestAnimationFrame(() => {
  //       setTourOpen(true);
  //       onboarding.start();
  //     });
  //     (globalThis as any).__raf2 = id2;
  //   });
  //   return () => cancelAnimationFrame(id1);
  // }, [auth, isGuest, isLoading, onboarding]);

  useEffect(() => {
    if (!auth?.token || !modelName) {
      disconnectCollabSocket();
      setLockState({ canEdit: false, lockId: null, holder: null, expiresAt: null });
      lockRef.current = { modelName, lockId: null };
      return;
    }

    let cancelled = false;

    connectCollabSocket({
      token: auth.token,
      modelName,
    });

    const setupLock = async () => {
      try {
        const info = await acquireModelLock(modelName);
        if (cancelled) return;
        const next = applyLockInfo(info);
        setLockState(next);
        lockRef.current = { modelName, lockId: next.lockId };
      } catch {
        try {
          const status = await getModelLock(modelName);
          if (cancelled) return;
          const next = applyLockInfo(status);
          setLockState(next);
          lockRef.current = { modelName, lockId: next.lockId };
        } catch {
          if (!cancelled) {
            setLockState({ canEdit: false, lockId: null, holder: null, expiresAt: null });
            lockRef.current = { modelName, lockId: null };
          }
        }
      }
    };

    void setupLock();

    return () => {
      cancelled = true;
      disconnectCollabSocket();
      void releaseCurrentLock();
    };
  }, [auth?.token, modelName]);

  useEffect(() => {
    if (!modelName || !lockState.canEdit || !lockState.lockId) {
      return;
    }

    const timer = globalThis.setInterval(() => {
      void renewModelLock(modelName, lockState.lockId as string)
        .then((info) => {
          const next = applyLockInfo(info);
          setLockState(next);
          lockRef.current = { modelName, lockId: next.lockId };
        })
        .catch(() => {
          setLockState((prev) => ({ ...prev, canEdit: false, lockId: null }));
          lockRef.current = { modelName, lockId: null };
        });
    }, 20000);

    return () => globalThis.clearInterval(timer);
  }, [modelName, lockState.canEdit, lockState.lockId]);

  useEffect(() => {
    const onBeforeUnload = () => {
      const currentModel = lockRef.current.modelName;
      const currentLockId = lockRef.current.lockId;
      if (!currentModel || !currentLockId) {
        return;
      }
      void releaseModelLock(currentModel, currentLockId);
    };

    globalThis.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      globalThis.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  const handleCreateNewModel = (nextModelName: string) => {
    globalThis.location.href = `/editor?model=${encodeURIComponent(nextModelName)}`;
  };

  const handleLoadExistingModel = (nextModelName: string) => {
    globalThis.location.href = `/editor?model=${encodeURIComponent(nextModelName)}`;
  };

  const handleModelSelection = (nextModelName: string, createNew: boolean) => {
    if (createNew) {
      handleCreateNewModel(nextModelName);
    } else {
      handleLoadExistingModel(nextModelName);
    }
  };

  if (!auth && !isGuest) {
    return (
      <AuthPage
        onAuthenticated={(a) => setAuth(a)}
        onContinueGuest={() => setIsGuest(true)}
        onModelSelected={handleModelSelection}
      />
    );
  }

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => globalThis.location.reload()} />;

  const plausibleTransitionCount =
    bmrgData ? bmrgData.transitions.filter((t) => t.time_25 === 1).length : 0;

  // Count states by VAST class for sidebar legend
  const classCountMap: Record<string, number> = {};
  if (bmrgData) {
    for (const s of bmrgData.states) {
      const cls = s.vast_state?.vast_class || 'Unknown';
      classCountMap[cls] = (classCountMap[cls] || 0) + 1;
    }
  }

  const legendItems = [
    { cls: 'Class I', label: 'Reference', bg: '#dcfce7', border: '#86efac' },
    { cls: 'Class II', label: 'Class II', bg: '#ecfccb', border: '#bef264' },
    { cls: 'Class III', label: 'Class III', bg: '#fef9c3', border: '#fde047' },
    { cls: 'Class IV', label: 'Class IV', bg: '#fef3c7', border: '#fcd34d' },
    { cls: 'Class V', label: 'Class V', bg: '#ffedd5', border: '#fdba74' },
    { cls: 'Class VI', label: 'Class VI', bg: '#fee2e2', border: '#fca5a5' },
  ];

  return (
    <div className="app-container">
      {/* ─── TOOLBAR ─── */}
      <div data-tour="toolbar">
        <GraphToolbar
          onAddNode={openAddNodeModal}
          onToggleEdgeCreation={toggleEdgeCreationMode}
          onLoadEdges={loadExistingEdges}
          onSaveModel={handleSaveModel}
          onOpenModelList={() => setIsModelListOpen(true)}
          onDeleteModel={handleDeleteModel}
          onApplyLayout={applyLayout}
          onSaveVersion={saveCurrentVersion}
          onOpenVersionManager={openVersionManager}
          onImportEKS={importFromEKS}
          onExportEKS={exportToEKS}
          onRelayout={handleReLayout}
          onToggleSelfTransitions={toggleSelfTransitions}
          edgeCreationMode={edgeCreationMode}
          isSaving={isSaving}
          showSelfTransitions={showSelfTransitions}
          bmrgData={bmrgData}
          onOpenHelp={() => setIsHelpOpen(true)}
          userEmail={auth?.user.email ?? null}
          isGuest={isGuest}
          canEdit={lockState.canEdit}
          lockHolder={lockState.holder}
          lockExpiresAt={lockState.expiresAt}
          onAcquireLock={() => {
            void handleAcquireLock();
          }}
          onRefreshLock={() => {
            void handleRefreshLock();
          }}
          onReleaseLock={() => {
            void handleReleaseLock();
          }}
          onLogout={() => {
            disconnectCollabSocket();
            void releaseCurrentLock();
            authStorage.clear();
            setAuth(null);
            setIsGuest(false);
          }}
          onSignIn={() => {
            setIsGuest(false);
          }}
        />
      </div>

      {/* ─── HEADER ─── */}
      <div className="header-bar">
        <div className="model-name">{bmrgData?.stm_name || 'STM Creator'}</div>
        {bmrgData && (
          <>
            <div className="meta-pill">
              <span className="dot dot-green"></span>
              {bmrgData.states.length} states
            </div>
            <div className="meta-pill">
              <span className="dot dot-amber"></span>
              {plausibleTransitionCount} / {bmrgData.transitions.length} transitions
            </div>
          </>
        )}

        {/* Lock status in header */}
        <div className="meta-pill" style={{ marginLeft: 'auto' }}>
          <span className="dot" style={{
            background: lockState.canEdit ? 'var(--accent)' : 'var(--amber)',
          }} />
          {lockState.canEdit ? 'Editing' : `Read-only${lockState.holder ? `: ${lockState.holder}` : ''}`}
        </div>

        {/* Auth info in header */}
        {auth?.user.email && (
          <div className="meta-pill">
            {auth.user.email}
          </div>
        )}
      </div>

      {/* ─── WORKSPACE ─── */}
      <div className="workspace">
        {/* LEFT SIDEBAR */}
        <div className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">Classes</div>
            {legendItems.map((item) => (
              <div className="legend-item" key={item.cls}>
                <div
                  className="legend-swatch"
                  style={{ background: item.bg, border: `1px solid ${item.border}` }}
                />
                <span className="legend-text">{item.label}</span>
                <span className="legend-count">{classCountMap[item.cls] || 0}</span>
              </div>
            ))}
          </div>

          <div className="sidebar-divider" />

          {/* Transition Filters in sidebar */}
          <TransitionFilterPanel
            bmrgData={bmrgData}
            showSelfTransitions={showSelfTransitions}
            deltaFilter={deltaFilter}
            onToggleSelfTransitions={toggleSelfTransitions}
            onDeltaFilterChange={toggleDeltaFilter}
            onReset={loadExistingEdges}
            inSidebar
          />
        </div>

        {/* CANVAS */}
        <div className="canvas-area">
          <ReactFlow
            nodes={nodesWithCallbacks}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={customEdgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            onNodesChange={onNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            edgesFocusable
            elementsSelectable
            edgesReconnectable={lockState.canEdit}
            reconnectRadius={10}
            fitView
            fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
            maxZoom={2}
            nodesDraggable={lockState.canEdit}
            connectOnClick={lockState.canEdit}
            zoomOnDoubleClick={false}
            panOnDrag
            panOnScroll
            snapToGrid
            snapGrid={[20, 20]}
          >
            <Background />
            <MiniMap />
            <Controls />
          </ReactFlow>

          {/* Status bar */}
          {bmrgData && (
            <div className="statusbar">
              <div className="statusbar-dot" />
              <span>nodes</span> <b>{bmrgData.states.length}</b>
              <span>transitions</span> <b>{plausibleTransitionCount}</b>
            </div>
          )}
        </div>

        {/* RIGHT PANEL (Tips) */}
        <div className={`right-panel ${tipsOpen ? 'open' : ''}`}>
          <div className="rp-inner">
            <TipsPanel onClose={() => setTipsOpen(false)} />
          </div>
        </div>
      </div>

      <Tour open={tourOpen} onClose={closeTour} steps={coachSteps} />

      <EdgeCreationHint isActive={edgeCreationMode} hasStartNode={Boolean(startNodeId)} />

      <NodeModal
        isOpen={isNodeModalOpen}
        onClose={closeNodeModal}
        onSave={handleSaveNode}
        onDelete={() => {
          const raw = initialNodeValues?.id ?? '';
          const idStr = raw.startsWith('state-') ? raw.replace('state-', '') : raw.replace('node-', '');
          const graphId = parseInt(idStr, 10);
          if (!Number.isNaN(graphId)) {
            handleDeleteState(graphId);
          }
        }}
        initialValues={initialNodeValues}
        isEditing={isEditing}
      />

      <TransitionModal
        isOpen={isTransitionModalOpen}
        onClose={closeTransitionModal}
        onSave={handleSaveTransition}
        onDelete={handleDeleteTransition}
        transition={currentTransition}
        stateNames={stateNameMap}
      />

      <VersionManagerModal
        isOpen={isVersionModalOpen}
        versions={versions}
        onClose={closeVersionManager}
        onRestore={restoreVersion}
        onDelete={deleteVersion}
      />

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <ModelListModal isOpen={isModelListOpen} onClose={() => setIsModelListOpen(false)} />
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor" element={<GraphEditor />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Navigate to="/editor" replace />} />
        <Route path="/notfound" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/notfound" replace />} />
      </Routes>
    </Router>
  );
}

export default function AppWithProvider() {
  return (
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  );
}
