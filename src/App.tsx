import {
  Background,
  Controls,
  MiniMap,
  Panel,
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

  useEffect(() => {
    if (!(auth || isGuest)) return;
    if (isLoading) return;
    if (onboarding.finished) return;

    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => {
        setTourOpen(true);
        onboarding.start();
      });
      (globalThis as any).__raf2 = id2;
    });
    return () => cancelAnimationFrame(id1);
  }, [auth, isGuest, isLoading, onboarding]);

  useEffect(() => {
    if (!auth?.token || !modelName) {
      setLockState({ canEdit: false, lockId: null, holder: null, expiresAt: null });
      lockRef.current = { modelName, lockId: null };
      return;
    }

    let cancelled = false;

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

  return (
    <div className="app-container">
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

        <Panel
          position="top-right"
          style={{ top: 156, right: 8, width: 360, zIndex: 18 }}
          data-tour="tips"
        >
          <TipsPanel />
        </Panel>

        <TransitionFilterPanel
          dataTourId="filters"
          bmrgData={bmrgData}
          showSelfTransitions={showSelfTransitions}
          deltaFilter={deltaFilter}
          onToggleSelfTransitions={toggleSelfTransitions}
          onDeltaFilterChange={toggleDeltaFilter}
          onReset={loadExistingEdges}
        />
      </ReactFlow>

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
