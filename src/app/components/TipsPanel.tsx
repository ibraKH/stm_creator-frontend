interface TipsPanelProps {
  onClose: () => void;
}

export function TipsPanel({ onClose }: TipsPanelProps) {
  return (
    <>
      <div className="rp-header">
        <span className="rp-title">Tips</span>
        <button className="rp-close" onClick={onClose}>×</button>
      </div>

      <div className="tip-card">
        <div className="tip-head">Nodes</div>
        <div className="tip-text">Click a node to edit its attributes. Double-click to rename inline.</div>
      </div>

      <div className="tip-card">
        <div className="tip-head">Edges</div>
        <div className="tip-text">Use <kbd>Create Edge</kbd> then click two nodes to connect them.</div>
      </div>

      <div className="tip-card">
        <div className="tip-head">Selection</div>
        <div className="tip-text">Click an edge to select it. Double-click to edit the transition details.</div>
      </div>

      <div className="tip-card">
        <div className="tip-head">Condition Bar</div>
        <div className="tip-text">The bar on each node visualises the midpoint of its condition range.</div>
      </div>

      <div className="tip-card">
        <div className="tip-head">Layout</div>
        <div className="tip-text">Use <kbd>Re-layout</kbd> to automatically optimize node positions.</div>
      </div>

      <div className="tip-card">
        <div className="tip-head">Filter</div>
        <div className="tip-text">Use the sidebar filters to show only specific transition types.</div>
      </div>
    </>
  );
}
