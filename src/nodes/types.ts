import type { Node } from '@xyflow/react';
import { NodeAttributes } from './nodeModal';

export type CustomNodeData = {
    label: string;
    onLabelChange?: (id: string, newLabel: string) => void;
    attributes?: NodeAttributes;
    onNodeClick?: (id: string) => void;
    isSelected?: boolean; // Added for edge creation highlighting
    isEdgeCreationMode?: boolean; // Added to indicate edge creation mode
    canEdit?: boolean;
    enableInlineEdit?: boolean;
    isLocked?: boolean;
    isLockedByMe?: boolean;
    lockOwner?: string | null;
    lockColor?: string | null;
};

export type PositionLoggerNode = Node<CustomNodeData, 'position-logger'>;
export type CustomNode = Node<CustomNodeData, 'custom'>;

// Combine all possible node types into AppNode
export type AppNode =
    | Node<CustomNodeData> // Generic node with our custom data
    | PositionLoggerNode
    | CustomNode;
