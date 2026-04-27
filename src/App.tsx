import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { CommentPanel } from './app/components/CommentPanel';
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
import { emitEntityPatch, subscribeEntityPatchEvents } from './collab/socket';
import { parseStateId } from './app/hooks/graph-utils';
import {
  connectCollabSocket,
  disconnectCollabSocket,
  emitCursorMove,
  emitNodeLockAcquire,
  emitNodeLockRelease,
  subscribeCursorEvents,
  subscribePresenceEvents,
  subscribeNodeLockEvents,
  type OnlineUser,
} from './collab/socket';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import AdminDashboard from './pages/AdminDashboard';
import VerifyEmail from './pages/VerifyEmail';
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute';

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

type RemoteCursorState = Record<
  number,
  {
    userId: number;
    x: number;
    y: number;
    color: string;
  }
>;

function GraphEditor() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isModelListOpen, setIsModelListOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsVersion, setCommentsVersion] = useState(0);

  const [auth, setAuth] = useState<{ token: string; user: AuthUser } | null>(() => {
    const token = authStorage.getToken();
    const user = authStorage.getUser();
    return token && user ? { token, user } : null;
  });
  const [isGuest, setIsGuest] = useState(false);
  const [nodeLocks, setNodeLocks] = useState<NodeLockState>({});
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursorState>({});
  const activeNodeLockRef = useRef<{ nodeId: string | null; entityId: number | null }>({
    nodeId: null,
    entityId: null,
  });
  const canvasAreaRef = useRef<HTMLDivElement | null>(null);
  const cursorEmitFrameRef = useRef<number | null>(null);
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const dragPatchFrameRef = useRef<number | null>(null);
  const pendingDragPatchRef = useRef<{
    nodeId: string;
    graphStateId: number;
    position: { x: number; y: number };
  } | null>(null);

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
    applyRemoteNodePatch,
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

  useEffect(() => {
    if (!modelName) return;

    const timer = window.setInterval(() => {
      setCommentsVersion((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [modelName]);

  const commentCountMap = useMemo(() => {
    if (!modelName) return {} as Record<string, number>;

    try {
      const raw = localStorage.getItem(`stmCreator.comments.${modelName}`);
      const comments = raw ? JSON.parse(raw) : [];
      const counts: Record<string, number> = {};

      nodesWithCallbacks.forEach((node) => {
        const label = ((node.data as any)?.label || '').trim();
        if (!label) return;

        const mentionToken = `@[${label}]`;

        const count = comments.filter((comment: any) =>
          typeof comment?.text === 'string' && comment.text.includes(mentionToken)
        ).length;

        counts[node.id] = count;
      });

      return counts;
    } catch {
      return {} as Record<string, number>;
    }
  }, [modelName, nodesWithCallbacks, commentsVersion]);

  const nodesForRender = nodesWithCallbacks.map((node) => ({
    ...node,
    data: {
      ...node.data,
      commentCount: commentCountMap[node.id] ?? 0,
      onCommentBubbleClick: () => {
        setCommentsOpen(true);
        setTipsOpen(false);
      },
    },
  }));

  // ---- Save validation: state id must be unique ----
  const validateUniqueStateIds = () => {
    const counts = new Map<string, number>();

    nodesWithCallbacks.forEach((node) => {
      const id = String(node.id ?? '').trim();
      if (!id) return;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });

    const duplicates = Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([id]) => id);

    return {
      valid: duplicates.length === 0,
      duplicates,
    };
  };

  const handleSaveModelWithValidation = async () => {
    const result = validateUniqueStateIds();

    if (!result.valid) {
      window.alert(`State ID must be unique. Duplicate IDs: ${result.duplicates.join(', ')}`);
      throw new Error('Validation failed');
    }

    return handleSaveModel();
  };

  const handleNodePatch = (field: string, value: unknown) => {
    const nodeId = initialNodeValues?.id;
    const graphStateId = nodeId ? parseStateId(nodeId) : null;
    if (!auth?.token || !modelName || !nodeId || graphStateId === null) {
      return;
    }

    emitEntityPatch(modelName, graphStateId, field, value);
    applyRemoteNodePatch(nodeId, graphStateId, field, value);
  };

  const emitNodePositionPatch = (graphStateId: number, position: { x: number; y: number }) => {
    if (!auth?.token || !modelName) {
      return;
    }

    emitEntityPatch(modelName, graphStateId, 'position', {
      x: position.x,
      y: position.y,
    });
  };

  const handleNodeDragStart = (_event: React.MouseEvent, node: { id: string }) => {
    void requestNodeEdit(node.id);
  };

  const handleNodeDrag = (_event: React.MouseEvent, node: { id: string; position: { x: number; y: number } }) => {
    const graphStateId = parseStateId(node.id);
    if (!auth?.token || !modelName || graphStateId === null) {
      return;
    }

    if (!nodeLocks[node.id]?.ownedByMe) {
      return;
    }

    pendingDragPatchRef.current = {
      nodeId: node.id,
      graphStateId,
      position: {
        x: node.position.x,
        y: node.position.y,
      },
    };

    if (dragPatchFrameRef.current !== null) {
      return;
    }

    dragPatchFrameRef.current = globalThis.requestAnimationFrame(() => {
      dragPatchFrameRef.current = null;
      const next = pendingDragPatchRef.current;
      if (!next) {
        return;
      }
      emitNodePositionPatch(next.graphStateId, next.position);
    });
  };

  const handleNodeDragStop = (_event: React.MouseEvent, node: { id: string; position: { x: number; y: number } }) => {
    const graphStateId = parseStateId(node.id);
    if (!auth?.token || !modelName || graphStateId === null || !nodeLocks[node.id]?.ownedByMe) {
      return;
    }

    if (dragPatchFrameRef.current !== null) {
      globalThis.cancelAnimationFrame(dragPatchFrameRef.current);
      dragPatchFrameRef.current = null;
    }
    pendingDragPatchRef.current = null;

    emitNodePositionPatch(graphStateId, {
      x: node.position.x,
      y: node.position.y,
    });
    emitNodeLockRelease(modelName, graphStateId);
  };

  useEffect(() => {
    modelNameFromLocks.current = modelName;

    if (!auth?.token || !modelName) {
      disconnectCollabSocket();
      setNodeLocks({});
      setOnlineUsers([]);
      setRemoteCursors({});
      activeNodeLockRef.current = { nodeId: null, entityId: null };
      return;
    }

    connectCollabSocket({
      token: auth.token,
      modelName,
    });

    const unsubscribePresence = subscribePresenceEvents({
      onSync: (payload) => {
        setOnlineUsers(payload.users);
      },
      onJoin: (payload) => {
        setOnlineUsers((prev) => {
          const next = prev.filter((user) => user.userId !== payload.user.userId);
          next.push(payload.user);
          return next;
        });
      },
      onLeave: (payload) => {
        setOnlineUsers((prev) => prev.filter((user) => user.userId !== payload.userId));
        setRemoteCursors((prev) => {
          const next = { ...prev };
          delete next[payload.userId];
          return next;
        });
      },
    });

    const unsubscribeCursor = subscribeCursorEvents({
      onMove: (payload) => {
        if (payload.userId === Number(auth.user.id)) {
          return;
        }
        setRemoteCursors((prev) => ({
          ...prev,
          [payload.userId]: {
            userId: payload.userId,
            x: payload.x,
            y: payload.y,
            color: payload.color || '#3b82f6',
          },
        }));
      },
    });

    const unsubscribeEntityPatch = subscribeEntityPatchEvents({
      onPatch: (payload) => {
        if (payload.entityType !== 'node' || payload.userId === Number(auth.user.id)) {
          return;
        }
        const nodeId = `state-${payload.entityId}`;
        applyRemoteNodePatch(nodeId, payload.entityId, payload.field, payload.value);
      },
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
      unsubscribePresence();
      unsubscribeCursor();
      unsubscribeEntityPatch();
      unsubscribe();
      releaseActiveNodeLock(modelName);
      disconnectCollabSocket();
      setNodeLocks({});
      setOnlineUsers([]);
      setRemoteCursors({});
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

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!auth?.token || !modelName || !canvasAreaRef.current) {
      return;
    }

    const rect = canvasAreaRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    pendingCursorRef.current = { x, y };

    if (cursorEmitFrameRef.current !== null) {
      return;
    }

    cursorEmitFrameRef.current = globalThis.requestAnimationFrame(() => {
      cursorEmitFrameRef.current = null;
      const next = pendingCursorRef.current;
      if (!next || !modelName) {
        return;
      }
      emitCursorMove(modelName, next.x, next.y);
    });
  };

  const handleCanvasMouseLeave = () => {
    pendingCursorRef.current = null;
    if (cursorEmitFrameRef.current !== null) {
      globalThis.cancelAnimationFrame(cursorEmitFrameRef.current);
      cursorEmitFrameRef.current = null;
    }
  };

  return (
    <div className="app-container">
      <div data-tour="toolbar">
        <GraphToolbar
          onAddNode={openAddNodeModal}
          onToggleEdgeCreation={toggleEdgeCreationMode}
          onLoadEdges={loadExistingEdges}
          onSaveModel={handleSaveModelWithValidation}
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
          onToggleComments={() => setCommentsOpen(prev => !prev)}
          userEmail={auth?.user.email ?? null}
          userRole={auth?.user.role ?? null}
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

        <div className="meta-pill">
          <span
            className="dot"
            style={{
              background: baseCanEdit ? 'var(--accent)' : 'var(--amber)',
            }}
          />
          {baseCanEdit ? 'Node-level editing' : 'Read-only'}
        </div>

        {auth?.user.email && (
          <div className="meta-pill">
            {auth.user.email}
          </div>
        )}

        <div className="presence-strip">
          <div className="presence-title">
            Online {onlineUsers.length > 0 ? `(${onlineUsers.length})` : ''}
          </div>
          {onlineUsers.length === 0 ? (
            <div className="presence-empty">No active collaborators</div>
          ) : (
            <div className="presence-list">
              {onlineUsers.map((user) => {
                const label = user.email?.trim() || `User ${user.userId}`;
                const initials = label.slice(0, 2).toUpperCase();
                const isMe = auth?.user && Number(auth.user.id) === user.userId;
                return (
                  <div
                    key={user.userId}
                    className={`presence-chip${isMe ? ' me' : ''}`}
                    title={`${label}${user.role ? ` (${user.role})` : ''}`}
                  >
                    <span
                      className="presence-avatar"
                      style={{ backgroundColor: user.color || '#3b82f6' }}
                    >
                      {initials}
                    </span>
                    <span className="presence-name">
                      {isMe ? `${label} (You)` : label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="workspace">
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

        <div
          ref={canvasAreaRef}
          className="canvas-area"
          onMouseMoveCapture={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
        >
          <ReactFlow
            nodes={nodesForRender}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={customEdgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            onNodesChange={onNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onNodeDragStart={handleNodeDragStart}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
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

          <div className="cursor-layer" aria-hidden="true">
            {Object.values(remoteCursors).map((cursor) => {
              const user = onlineUsers.find((item) => item.userId === cursor.userId);
              const label = user?.email?.trim() || `User ${cursor.userId}`;
              return (
                <div
                  key={cursor.userId}
                  className="remote-cursor"
                  style={
                    {
                      left: cursor.x,
                      top: cursor.y,
                      '--cursor-color': cursor.color,
                    } as React.CSSProperties
                  }
                >
                  <div className="remote-cursor-pointer" />
                  <div className="remote-cursor-label">{label}</div>
                </div>
              );
            })}
          </div>

          {bmrgData && (
            <div className="statusbar">
              <div className="statusbar-dot" />
              <span>nodes</span> <b>{bmrgData.states.length}</b>
              <span>transitions</span> <b>{plausibleTransitionCount}</b>
            </div>
          )}
        </div>

        <div className={`right-panel ${tipsOpen || commentsOpen ? 'open' : ''}`}>
          <div className="rp-inner">
            {commentsOpen ? (
              <CommentPanel
                onClose={() => setCommentsOpen(false)}
                nodes={nodesForRender.map((n) => ({ id: n.id, label: (n.data as any).label || n.id }))}
                edges={edges.map((e) => {
                  const srcNode = nodesForRender.find((n) => n.id === e.source);
                  const tgtNode = nodesForRender.find((n) => n.id === e.target);
                  return {
                    id: e.id,
                    sourceLabel: (srcNode?.data as any)?.label || e.source,
                    targetLabel: (tgtNode?.data as any)?.label || e.target,
                  };
                })}
                userEmail={auth?.user.email || 'Guest'}
                modelName={modelName || 'unnamed'}
              />
            ) : tipsOpen ? (
              <TipsPanel onClose={() => setTipsOpen(false)} />
            ) : null}
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
        onPatch={handleNodePatch}
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
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/notfound" element={<NotFound />} />
        <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
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