import { AppNode, CustomNodeData } from '../../nodes/types';
import { NodeAttributes } from '../../nodes/nodeModal';

import { optimizeNodeLayout } from './layout';
import { StateData, TransitionData } from './types';
import { getGraphStateId } from './helpers';

function getConditionString(state: StateData): string {
    if (state.condition_upper === -9999 || state.condition_lower === -9999) {
        return 'No condition data';
    }
    return `Condition range: ${state.condition_lower.toFixed(2)} - ${state.condition_upper.toFixed(2)}`;
}

function stateToNodeAttributes(state: StateData): NodeAttributes {
    const id = getGraphStateId(state);
    const imageUrls = normaliseImageUrls(state.attributes);
    return {
        stateName: state.state_name,
        stateNumber: id.toString(),
        vastClass: state.vast_state.vast_class,
        condition: getConditionString(state),
        imageUrl: imageUrls[0] ?? '',
        imageUrls,
        note: state.attributes?.note ?? '',
        template: state.attributes?.template,
    };
}

function normaliseImageUrls(attributes: any): string[] {
    if (!attributes) {
        return [];
    }
    if (Array.isArray(attributes.imageUrls)) {
        return attributes.imageUrls.filter((url: unknown): url is string => typeof url === 'string' && url.trim() !== '');
    }
    return typeof attributes.imageUrl === 'string' && attributes.imageUrl.trim() !== '' ? [attributes.imageUrl] : [];
}

function getStoredPosition(state: StateData): { x: number; y: number } | null {
    const position = state.attributes?.position;
    if (!position || typeof position !== 'object') {
        return null;
    }

    const { x, y } = position as { x?: unknown; y?: unknown };
    if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) {
        return null;
    }

    return { x, y };
}

export function statesToNodes(
    states: StateData[],
    onLabelChange: (id: string, newLabel: string) => void,
    onNodeClick: (id: string) => void,
    transitions: TransitionData[] = []
): AppNode[] {
    const positions = optimizeNodeLayout(states, transitions);

    return states.map((state) => {
        const graphId = getGraphStateId(state);
        const position = getStoredPosition(state) ?? positions.get(graphId) ?? { x: 0, y: 0 };

        return {
            id: `state-${graphId}`,
            type: 'custom',
            position,
            data: {
                label: state.state_name,
                onLabelChange,
                onNodeClick,
                attributes: stateToNodeAttributes(state),
            } as CustomNodeData,
        } as AppNode;
    });
}
