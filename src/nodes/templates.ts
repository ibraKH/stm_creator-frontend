// Template data model for node creation.
// Based on Supporting Information S4 — primary templates for forests/woodlands,
// shrublands and grasslands (Jan 2026 working draft).

export type BiomeType = 'woodlands' | 'shrublands' | 'grasslands';

// Four standard layer conditions used by the 4x4 matrix.
export type LayerCondition =
    | 'close-to-reference'
    | 'modified'
    | 'highly-modified'
    | 'collapsed-transformer';

// Second-level dropdown "group". The layer group uses a LayerCondition for the
// primary layer of the biome; the two special groups cover cultivated-woody
// systems and intensive land uses.
export type PrimaryGroupKind = 'layer' | 'cultivated-woody' | 'intensive';

export interface BiomeConfig {
    readonly id: BiomeType;
    readonly label: string;
    readonly primaryLayerName: string;   // e.g. "tree layer"
    readonly secondaryLayerName: string; // e.g. "shrub/ground layers"
    // Whether the "highly modified" condition is labelled "/absent" in this
    // biome. Woodlands and shrublands use "Highly modified/absent" in the
    // individual template labels; grasslands use just "Highly modified".
    readonly highlyModifiedIncludesAbsent: boolean;
}

export const BIOMES: Record<BiomeType, BiomeConfig> = {
    woodlands: {
        id: 'woodlands',
        label: 'Woodlands',
        primaryLayerName: 'tree layer',
        secondaryLayerName: 'shrub/ground layers',
        highlyModifiedIncludesAbsent: true,
    },
    shrublands: {
        id: 'shrublands',
        label: 'Shrublands',
        primaryLayerName: 'shrub layer',
        secondaryLayerName: 'tree/ground layers',
        highlyModifiedIncludesAbsent: true,
    },
    grasslands: {
        id: 'grasslands',
        label: 'Grasslands',
        primaryLayerName: 'ground layer',
        secondaryLayerName: 'tree/shrub layers',
        highlyModifiedIncludesAbsent: false,
    },
};

export const BIOME_ORDER: BiomeType[] = ['woodlands', 'shrublands', 'grasslands'];

export const LAYER_CONDITION_ORDER: LayerCondition[] = [
    'close-to-reference',
    'modified',
    'highly-modified',
    'collapsed-transformer',
];

// Pretty text for a condition used in the PRIMARY layer of a biome.
// e.g. 'highly-modified' + woodlands -> "Highly modified/absent"
export function primaryConditionText(
    biome: BiomeType,
    condition: LayerCondition,
): string {
    switch (condition) {
        case 'close-to-reference':
            return 'Close to reference';
        case 'modified':
            return 'Modified';
        case 'highly-modified':
            return BIOMES[biome].highlyModifiedIncludesAbsent
                ? 'Highly modified/absent'
                : 'Highly modified';
        case 'collapsed-transformer':
            return 'Collapsed/transformer';
    }
}

// Pretty text for a condition used in the SECONDARY layers of a biome.
// Mirrors the phrasing in the PDF: for all three biomes the secondary text
// is "Close to reference" / "Modified" / "Highly modified" / "Collapsed/transformer"
// (note: no "/absent" is used in any biome's secondary description in the PDF).
export function secondaryConditionText(condition: LayerCondition): string {
    switch (condition) {
        case 'close-to-reference':
            return 'close to reference';
        case 'modified':
            return 'modified';
        case 'highly-modified':
            return 'highly modified';
        case 'collapsed-transformer':
            return 'collapsed/transformer';
    }
}

// "Close to reference tree layer"
export function primaryGroupLabel(
    biome: BiomeType,
    condition: LayerCondition,
): string {
    return `${primaryConditionText(biome, condition)} ${BIOMES[biome].primaryLayerName}`;
}

// "Close to reference tree layer with modified shrub/ground layers"
export function layerTemplateLabel(
    biome: BiomeType,
    primary: LayerCondition,
    secondary: LayerCondition,
): string {
    const cfg = BIOMES[biome];
    return `${primaryGroupLabel(biome, primary)} with ${secondaryConditionText(secondary)} ${cfg.secondaryLayerName}`;
}

// ---------- Special (non-layer) templates ----------

// "Cultivated woody" has a single combined template per biome covering
// modified / highly modified / collapsed-transformer complementary layers.
export const CULTIVATED_WOODY_SECONDARY = 'mixed-complementary' as const;

// Intensive land uses sub-types (same 3 sub-types across all biomes)
export type IntensiveKind = 'crops' | 'exotic-pastures' | 'artificial-surfaces';

export const INTENSIVE_ORDER: IntensiveKind[] = [
    'crops',
    'exotic-pastures',
    'artificial-surfaces',
];

export function intensiveLabel(kind: IntensiveKind): string {
    switch (kind) {
        case 'crops':
            return 'Crops';
        case 'exotic-pastures':
            return 'Intensively managed exotic pastures';
        case 'artificial-surfaces':
            return 'Artificial surfaces and infrastructure (e.g. buildings, roads, mine pits)';
    }
}

// ---------- Template identity ----------

// A NodeTemplate represents one concrete choice from the 3rd-level dropdown.
// Templates are identified by a stable string id so we can persist them on
// the node attributes and restore the dropdown state when editing.
export interface NodeTemplate {
    readonly id: string;
    readonly biome: BiomeType;
    // Second-level (primary group) metadata
    readonly primaryGroup: PrimaryGroupKind;
    readonly primaryCondition?: LayerCondition; // only for primaryGroup === 'layer'
    // Third-level metadata
    readonly secondaryCondition?: LayerCondition; // for 'layer' group
    readonly intensiveKind?: IntensiveKind;       // for 'intensive' group
    // Full human-readable label
    readonly label: string;
    // Short label shown in the 3rd-level dropdown (value relative to the
    // selected primary group). For a layer template this is the "with ..."
    // phrase; for cultivated/intensive it is just the full label.
    readonly shortLabel: string;
    // Second-level group display label (shown in dropdown level 2).
    readonly groupLabel: string;
}

function buildLayerTemplate(
    biome: BiomeType,
    primary: LayerCondition,
    secondary: LayerCondition,
): NodeTemplate {
    const cfg = BIOMES[biome];
    return {
        id: `${biome}.layer.${primary}.${secondary}`,
        biome,
        primaryGroup: 'layer',
        primaryCondition: primary,
        secondaryCondition: secondary,
        label: layerTemplateLabel(biome, primary, secondary),
        shortLabel: `with ${secondaryConditionText(secondary)} ${cfg.secondaryLayerName}`,
        groupLabel: primaryGroupLabel(biome, primary),
    };
}

function buildCultivatedWoodyTemplate(biome: BiomeType): NodeTemplate {
    const label =
        'Cultivated woody with modified/highly modified/collapsed/transformer complementary layers';
    return {
        id: `${biome}.cultivated-woody`,
        biome,
        primaryGroup: 'cultivated-woody',
        label,
        shortLabel: label,
        groupLabel: 'Cultivated woody',
    };
}

function buildIntensiveTemplate(
    biome: BiomeType,
    kind: IntensiveKind,
): NodeTemplate {
    return {
        id: `${biome}.intensive.${kind}`,
        biome,
        primaryGroup: 'intensive',
        intensiveKind: kind,
        label: intensiveLabel(kind),
        shortLabel: intensiveLabel(kind),
        groupLabel: 'Intensive land uses',
    };
}

// Full flat list of all templates, generated once at module load.
export const NODE_TEMPLATES: NodeTemplate[] = (() => {
    const templates: NodeTemplate[] = [];
    for (const biome of BIOME_ORDER) {
        // 16 layer templates per biome (4 primary x 4 secondary)
        for (const primary of LAYER_CONDITION_ORDER) {
            for (const secondary of LAYER_CONDITION_ORDER) {
                templates.push(buildLayerTemplate(biome, primary, secondary));
            }
        }
        // Cultivated woody (1 per biome)
        templates.push(buildCultivatedWoodyTemplate(biome));
        // Intensive land uses (3 per biome)
        for (const kind of INTENSIVE_ORDER) {
            templates.push(buildIntensiveTemplate(biome, kind));
        }
    }
    return templates;
})();

export const TEMPLATES_BY_ID: Record<string, NodeTemplate> = NODE_TEMPLATES.reduce(
    (acc, t) => {
        acc[t.id] = t;
        return acc;
    },
    {} as Record<string, NodeTemplate>,
);

// ---------- Dropdown helpers ----------

export interface PrimaryGroupOption {
    readonly key: string;              // unique per (biome + group)
    readonly kind: PrimaryGroupKind;
    readonly condition?: LayerCondition; // for 'layer' group
    readonly label: string;
}

export function listPrimaryGroupOptions(biome: BiomeType): PrimaryGroupOption[] {
    const options: PrimaryGroupOption[] = [];
    for (const cond of LAYER_CONDITION_ORDER) {
        options.push({
            key: `layer.${cond}`,
            kind: 'layer',
            condition: cond,
            label: primaryGroupLabel(biome, cond),
        });
    }
    options.push({
        key: 'cultivated-woody',
        kind: 'cultivated-woody',
        label: 'Cultivated woody',
    });
    options.push({
        key: 'intensive',
        kind: 'intensive',
        label: 'Intensive land uses',
    });
    return options;
}

export function listTemplatesForGroup(
    biome: BiomeType,
    groupKey: string,
): NodeTemplate[] {
    return NODE_TEMPLATES.filter((t) => {
        if (t.biome !== biome) return false;
        if (t.primaryGroup === 'layer') {
            return groupKey === `layer.${t.primaryCondition}`;
        }
        return groupKey === t.primaryGroup;
    });
}

export function primaryGroupKeyOf(template: NodeTemplate): string {
    if (template.primaryGroup === 'layer') {
        return `layer.${template.primaryCondition}`;
    }
    return template.primaryGroup;
}

// Lightweight reference we persist on NodeAttributes so the dropdowns can be
// rehydrated when editing an existing node.
export interface TemplateRef {
    readonly id: string;
    readonly biome: BiomeType;
    readonly label: string;
}

export function makeTemplateRef(template: NodeTemplate): TemplateRef {
    return { id: template.id, biome: template.biome, label: template.label };
}
