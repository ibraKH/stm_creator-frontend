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
import { MilestoneModal } from './app/components/MilestoneModal';
import { ModelListModal } from './app/components/ModelListModal';
import { HelpModal } from './app/components/HelpModal';
import { useGraphEditor } from './app/hooks/useGraphEditor';
import { NodeModal } from './nodes/nodeModal';
import { TransitionModal } from './transitions/transitionModal';

import { TransitionFilterPanel } from './extensions/TransitionFilterPanel';
import './extensions/extensions.css';

import AuthPage from './app/auth/AuthPage';
import { authStorage, type AuthUser } from './app/auth/api';
import { parseStateId } from './app/hooks/graph-utils';
import {
  connectCollabSocket,
  disconnectCollabSocket,
  emitNodeLockAcquire,
  emitNodeLockRelease,
  subscribeNodeLockEvents,
} from './collab/socket';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

import { Tour } from './extensions/onboarding/Tour';
import { coachSteps } from './extensions/onboarding/coachmarks';
import { useOnboarding } from './extensions/onboarding/useOnboarding';

type NodeLockState = Record<
  string,
  {
    entityId: number;
    lockOwner: string | null;
    lockColor: string | null;
    ownedByMe: boolean;
  }
>;

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
  const [nodeLocks, setNodeLocks] = useState<NodeLockState>({});
  const activeNodeLockRef = useRef<{ nodeId: string | null; entityId: number | null }>({
    nodeId: null,
    entityId: null,
  });

  const onboarding = useOnboarding();

  const [tourOpen, setTourOpen] = useState<boolean>(false);
  const closeTour = () => {
    setTourOpen(false);
    onboarding.complete();
  };

  const modelNameFromLocks = useRef<string | null>(null);
  const baseCanEdit = Boolean(auth || isGuest);

  const releaseActiveNodeLock = (reasonModelName?: string | null) => {
    const activeNodeId = activeNodeLockRef.current.nodeId;
    const activeEntityId = activeNodeLockRef.current.entityId;
    const effectiveModelName = reasonModelName ?? modelNameFromLocks.current;
    if (!activeNodeId || !activeEntityId || !effectiveModelName) {
      activeNodeLockRef.current = { nodeId: null, entityId: null };
      return;
    }

    emitNodeLockRelease(effectiveModelName, activeEntityId);
    activeNodeLockRef.current = { nodeId: null, entityId: null };
    setNodeLocks((prev) => {
      const next = { ...prev };
      delete next[activeNodeId];
      return next;
    });
  };

  const requestNodeEdit = async (nodeId: string): Promise<boolean> => {
    if (!baseCanEdit) {
      window.alert('Please sign in or continue as guest to edit nodes.');
      return false;
    }

    const entityId = parseStateId(nodeId);
    if (!auth?.token || !modelName || entityId === null) {
      return true;
    }

    const existing = nodeLocks[nodeId];
    if (existing?.ownedByMe) {
      activeNodeLockRef.current = { nodeId, entityId };
      return true;
    }

    if (existing && !existing.ownedByMe) {
      window.alert(`Node is currently being edited by ${existing.lockOwner ?? 'another user'}.`);
      return false;
    }

    releaseActiveNodeLock(modelName);

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      let unsubscribe: () => void = () => {};

      const finish = (allowed: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        globalThis.clearTimeout(timeout);
        unsubscribe();
        resolve(allowed);
      };

      unsubscribe = subscribeNodeLockEvents({
        onAcquired: (payload) => {
          if (payload.entityType !== 'node' || payload.entityId !== entityId || payload.modelName !== modelName) {
            return;
          }
          setNodeLocks((prev) => ({
            ...prev,
            [nodeId]: {
              entityId,
              lockOwner: payload.lockedBy ?? auth.user.email,
              lockColor: payload.color ?? '#22c55e',
              ownedByMe: payload.userId === Number(auth.user.id),
            },
          }));
          if (payload.userId === Number(auth.user.id)) {
            activeNodeLockRef.current = { nodeId, entityId };
            finish(true);
          }
        },
        onDenied: (payload) => {
          if (payload.entityType !== 'node' || payload.entityId !== entityId || payload.modelName !== modelName) {
            return;
          }
          window.alert(`Node is currently being edited by ${payload.lockedBy ?? 'another user'}.`);
          finish(false);
        },
      });

      const timeout = globalThis.setTimeout(() => {
        unsubscribe();
        window.alert('Unable to acquire node lock from collaboration service.');
        resolve(false);
      }, 2000);
      emitNodeLockAcquire(modelName, entityId);
    });
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
    canEdit: baseCanEdit,
    onReadOnlyAction: () => {
      window.alert('You do not currently have permission to edit this view.');
    },
    requestNodeEdit,
    nodeLocks,
  });

  const modelName = bmrgData?.stm_name?.trim() || null;

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
    modelNameFromLocks.current = modelName;

    if (!auth?.token || !modelName) {
      disconnectCollabSocket();
      setNodeLocks({});
      activeNodeLockRef.current = { nodeId: null, entityId: null };
      return;
    }

    connectCollabSocket({
      token: auth.token,
      modelName,
    });

    const unsubscribe = subscribeNodeLockEvents({
      onAcquired: (payload) => {
        if (payload.entityType !== 'node' || payload.modelName !== modelName) {
          return;
        }
        const nodeId = `state-${payload.entityId}`;
        setNodeLocks((prev) => ({
          ...prev,
          [nodeId]: {
            entityId: payload.entityId,
            lockOwner: payload.lockedBy ?? null,
            lockColor: payload.color ?? '#f59e0b',
            ownedByMe: payload.userId === Number(auth.user.id),
          },
        }));
      },
      onReleased: (payload) => {
        if (payload.entityType !== 'node' || payload.modelName !== modelName) {
          return;
        }
        const nodeId = `state-${payload.entityId}`;
        setNodeLocks((prev) => {
          const next = { ...prev };
          delete next[nodeId];
          return next;
        });
        if (activeNodeLockRef.current.entityId === payload.entityId) {
          activeNodeLockRef.current = { nodeId: null, entityId: null };
        }
      },
    });

    return () => {
      unsubscribe();
      releaseActiveNodeLock(modelName);
      disconnectCollabSocket();
      setNodeLocks({});
    };
  }, [auth?.token, auth?.user.id, modelName]);

  useEffect(() => {
    const onBeforeUnload = () => {
      releaseActiveNodeLock(modelNameFromLocks.current);
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
          onCreateNewModel={handleCreateNewModel}
          onDeleteModel={handleDeleteModel}
          onApplyLayout={applyLayout}
          onOpenMilestone={openVersionManager}
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
          canEdit={baseCanEdit}
          onLogout={() => {
            releaseActiveNodeLock(modelName);
            disconnectCollabSocket();
            authStorage.clear();
            setAuth(null);
            setIsGuest(false);
            setNodeLocks({});
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
            background: baseCanEdit ? 'var(--accent)' : 'var(--amber)',
          }} />
          {baseCanEdit ? 'Node-level editing' : 'Read-only'}
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
            edgesReconnectable={baseCanEdit}
            reconnectRadius={10}
            fitView
            fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
            maxZoom={2}
            nodesDraggable={baseCanEdit}
            connectOnClick={baseCanEdit}
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
        onClose={() => {
          releaseActiveNodeLock(modelName);
          closeNodeModal();
        }}
        onSave={(attributes) => {
          handleSaveNode(attributes);
          releaseActiveNodeLock(modelName);
        }}
        onDelete={() => {
          const raw = initialNodeValues?.id ?? '';
          const idStr = raw.startsWith('state-') ? raw.replace('state-', '') : raw.replace('node-', '');
          const graphId = parseInt(idStr, 10);
          if (!Number.isNaN(graphId)) {
            handleDeleteState(graphId);
          }
          releaseActiveNodeLock(modelName);
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

      <MilestoneModal
        isOpen={isVersionModalOpen}
        versions={versions}
        onClose={closeVersionManager}
        onSave={saveCurrentVersion}
        onRestore={restoreVersion}
        onDelete={deleteVersion}
        canEdit={baseCanEdit}
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
