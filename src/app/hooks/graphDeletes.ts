import { Dispatch, SetStateAction } from 'react';
import { BMRGData, TransitionData, statesToNodes } from '../../utils/stateTransition';
import { deleteModel as apiDeleteModel, deleteState as apiDeleteState, deleteTransition as apiDeleteTransition } from '../api/models';

type Deps = {
  getData: () => BMRGData | null;
  setData: Dispatch<SetStateAction<BMRGData | null>>;
  setNodes: Dispatch<SetStateAction<any[]>>; // AppNode[] but avoid import cycle
  rebuildEdges: (options?: { transitions?: TransitionData[]; dataOverride?: BMRGData | null }) => void;
  handleNodeLabelChange: (id: string, label: string) => void;
  handleNodeClick: (id: string) => void;
};

export function createDeleteActions({ getData, setData, setNodes, rebuildEdges, handleNodeLabelChange, handleNodeClick }: Deps) {
  const removeTransitionLocal = (tId: number) => {
    setData(prev => {
      if (!prev) return prev;
      const next: BMRGData = { ...prev, transitions: prev.transitions.filter(t => t.transition_id !== tId) };
      rebuildEdges({ transitions: next.transitions, dataOverride: next });
      return next;
    });
  };

  const handleDeleteTransition = async (transition: TransitionData) => {
    const data = getData();
    if (!data) return;
    const tId = transition.transition_id;
    if (typeof tId !== 'number') {
      // not persisted yet; local-only removal
      removeTransitionLocal(tId as any);
      return;
    }
    try {
      if (!confirm(`Delete transition ${tId}? This cannot be undone.`)) return;
      await apiDeleteTransition(data.stm_name, tId);
      removeTransitionLocal(tId);
      alert('Transition deleted');
    } catch (e) {
      alert((e as Error).message || 'Failed to delete transition');
    }
  };

  const handleDeleteState = async (graphStateId: number) => {
    const data = getData();
    if (!data) return;
    // find state by either state_id or frontend_state_id
    const st = data.states.find(s => (s.state_id ?? s.frontend_state_id) === graphStateId);
    if (!st) return;
    const dbId = st.state_id;
    try {
      if (!confirm(`Delete state "${st.state_name}" and its related transitions?`)) return;
      if (typeof dbId === 'number') {
        await apiDeleteState(data.stm_name, dbId);
      }
      // local removal of state and any transitions using it
      setData(prev => {
        if (!prev) return prev;
        const remainingStates = prev.states.filter(s => (s.state_id ?? s.frontend_state_id) !== graphStateId);
        const remainingTransitions = prev.transitions.filter(t => t.start_state_id !== graphStateId && t.end_state_id !== graphStateId);
        const next: BMRGData = { ...prev, states: remainingStates, transitions: remainingTransitions };
        const nodes = statesToNodes(next.states, handleNodeLabelChange, handleNodeClick, next.transitions);
        setNodes(nodes);
        rebuildEdges({ transitions: remainingTransitions, dataOverride: next });
        return next;
      });
      alert('State deleted');
    } catch (e) {
      alert((e as Error).message || 'Failed to delete state');
    }
  };

  const handleDeleteModel = async () => {
    const data = getData();
    if (!data) return;
    try {
      if (!confirm(`Delete model "${data.stm_name}" and ALL its data?`)) return;
      await apiDeleteModel(data.stm_name);
      try { localStorage.removeItem('stmCreator.lastModelName'); } catch {}
      alert('Model deleted');
      // Reload to reset app state cleanly
      window.location.href = '/editor';
    } catch (e) {
      alert((e as Error).message || 'Failed to delete model');
    }
  };

  return { handleDeleteTransition, handleDeleteState, handleDeleteModel };
}

