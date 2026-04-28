import React, { useEffect, useMemo, useState } from 'react';
import {
    BIOMES,
    BIOME_ORDER,
    TEMPLATES_BY_ID,
    listPrimaryGroupOptions,
    listTemplatesForGroup,
    makeTemplateRef,
    primaryGroupKeyOf,
    type BiomeType,
    type TemplateRef,
} from './templates';

export interface NodeAttributes {
    stateName: string;
    stateNumber: string;
    vastClass: string;
    condition: string;
    imageUrl?: string;
    imageUrls?: string[];
    note?: string;
    id?: string;
    template?: TemplateRef;
}

interface NodeModalProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onSave: (attributes: NodeAttributes) => void;
    readonly onPatch?: (field: string, value: unknown) => void;
    readonly onDelete?: () => void;
    readonly onDuplicate?: () => void;
    readonly initialValues?: NodeAttributes;
    readonly isEditing: boolean;
}

const CONDITION_CLASSES = [
    'Class I',
    'Class II',
    'Class III',
    'Class IV',
    'Class V',
    'Class VI',
];

function normaliseImageUrls(attributes: NodeAttributes | undefined): string[] {
    if (!attributes) {
        return [];
    }
    if (Array.isArray(attributes.imageUrls) && attributes.imageUrls.length > 0) {
        return attributes.imageUrls.filter((url) => typeof url === 'string' && url.trim() !== '');
    }
    return attributes.imageUrl ? [attributes.imageUrl] : [];
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

export function NodeModal({
    isOpen,
    onClose,
    onSave,
    onPatch,
    onDelete,
    onDuplicate,
    initialValues,
    isEditing,
}: NodeModalProps) {
    const [attributes, setAttributes] = useState<NodeAttributes>({
        stateName: '',
        stateNumber: '',
        vastClass: '',
        condition: '',
        imageUrl: '',
        imageUrls: [],
        note: '',
    });
    const [lowerBound, setLowerBound] = useState<string>('');
    const [upperBound, setUpperBound] = useState<string>('');
    const [biome, setBiome] = useState<BiomeType | ''>('');
    const [primaryGroupKey, setPrimaryGroupKey] = useState<string>('');
    const [templateId, setTemplateId] = useState<string>('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        if (initialValues) {
            const imageUrls = normaliseImageUrls(initialValues);
            setAttributes({
                ...initialValues,
                imageUrl: imageUrls[0] ?? '',
                imageUrls,
            });

            const regex = /Condition\s*range:\s*([\d.+-]+)\s*-\s*([\d.+-]+)/i;
            const match = regex.exec(initialValues.condition ?? '');
            if (match) {
                setLowerBound(match[1]);
                setUpperBound(match[2]);
            } else {
                setLowerBound('');
                setUpperBound('');
            }

            const storedRef = initialValues.template;
            const storedTemplate = storedRef ? TEMPLATES_BY_ID[storedRef.id] : undefined;
            if (storedTemplate) {
                setBiome(storedTemplate.biome);
                setPrimaryGroupKey(primaryGroupKeyOf(storedTemplate));
                setTemplateId(storedTemplate.id);
            } else {
                setBiome('');
                setPrimaryGroupKey('');
                setTemplateId('');
            }
        } else {
            setAttributes({
                stateName: '',
                stateNumber: '',
                vastClass: '',
                condition: '',
                imageUrl: '',
                imageUrls: [],
                note: '',
            });
            setLowerBound('');
            setUpperBound('');
            setBiome('');
            setPrimaryGroupKey('');
            setTemplateId('');
        }
        setPreviewImage(null);
    }, [initialValues, isOpen]);

    const primaryGroupOptions = useMemo(
        () => (biome ? listPrimaryGroupOptions(biome) : []),
        [biome],
    );
    const templateOptions = useMemo(
        () => (biome && primaryGroupKey ? listTemplatesForGroup(biome, primaryGroupKey) : []),
        [biome, primaryGroupKey],
    );

    const commitImageUrls = (imageUrls: string[]) => {
        const nextUrls = imageUrls.filter(Boolean);
        const imageUrl = nextUrls[0] ?? '';
        setAttributes((prev) => ({ ...prev, imageUrl, imageUrls: nextUrls }));
        if (isEditing) {
            onPatch?.('imageUrls', nextUrls);
            onPatch?.('imageUrl', imageUrl);
        }
    };

    const handleImageUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) {
            return;
        }
        const uploaded = (await Promise.all(Array.from(files).map(readFileAsDataUrl))).filter(Boolean);
        commitImageUrls([...normaliseImageUrls(attributes), ...uploaded]);
    };

    const handleRemoveImage = (indexToRemove: number) => {
        commitImageUrls(normaliseImageUrls(attributes).filter((_, index) => index !== indexToRemove));
    };

    const handleBiomeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value as BiomeType | '';
        setBiome(value);
        setPrimaryGroupKey('');
        setTemplateId('');
        setAttributes((prev) => ({ ...prev, template: undefined }));
        if (isEditing) {
            onPatch?.('template', undefined);
        }
    };

    const handlePrimaryGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setPrimaryGroupKey(e.target.value);
        setTemplateId('');
        setAttributes((prev) => ({ ...prev, template: undefined }));
        if (isEditing) {
            onPatch?.('template', undefined);
        }
    };

    const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setTemplateId(id);
        const template = TEMPLATES_BY_ID[id];
        if (!template) {
            setAttributes((prev) => ({ ...prev, template: undefined }));
            if (isEditing) {
                onPatch?.('template', undefined);
            }
            return;
        }

        const ref = makeTemplateRef(template);
        setAttributes((prev) => {
            const shouldPrefillName = !prev.stateName || prev.stateName.trim() === '';
            const next: NodeAttributes = {
                ...prev,
                template: ref,
                stateName: shouldPrefillName ? template.label : prev.stateName,
            };
            if (isEditing && shouldPrefillName) {
                onPatch?.('stateName', next.stateName);
            }
            return next;
        });
        if (isEditing) {
            onPatch?.('template', ref);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setAttributes((prev) => ({
            ...prev,
            [name]: value,
        }));
        if (isEditing) {
            onPatch?.(name, value);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const lower = parseFloat(lowerBound);
        const upper = parseFloat(upperBound);
        if (Number.isNaN(lower) || Number.isNaN(upper) || lower >= upper) {
            return;
        }

        const imageUrls = normaliseImageUrls(attributes);
        onSave({
            ...attributes,
            condition: `Condition range: ${lower.toFixed(2)} - ${upper.toFixed(2)}`,
            imageUrl: imageUrls[0] ?? '',
            imageUrls,
        });
    };

    if (!isOpen) return null;

    const imageUrls = normaliseImageUrls(attributes);
    const lower = parseFloat(lowerBound);
    const upper = parseFloat(upperBound);
    const boundsInvalid = Number.isNaN(lower) || Number.isNaN(upper) || lower >= upper;

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <h2 style={{ marginTop: 0 }}>{isEditing ? 'Edit Node' : 'Add New Node'}</h2>

                <form onSubmit={handleSubmit}>
                    <div style={sectionStyle}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>
                            Template <span style={{ color: '#6b7280', fontWeight: 400 }}>(optional)</span>
                        </div>

                        <label style={labelStyle}>
                            <span style={labelTextStyle}>Biome</span>
                            <select value={biome} onChange={handleBiomeChange} style={selectStyle}>
                                <option value="">Select a biome</option>
                                {BIOME_ORDER.map((b) => (
                                    <option key={b} value={b}>
                                        {BIOMES[b].label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label style={labelStyle}>
                            <span style={labelTextStyle}>Primary Layer</span>
                            <select
                                value={primaryGroupKey}
                                onChange={handlePrimaryGroupChange}
                                disabled={!biome}
                                style={{ ...selectStyle, backgroundColor: biome ? 'white' : '#f3f4f6' }}
                            >
                                <option value="">
                                    {biome ? 'Select a primary layer' : 'Select a biome first'}
                                </option>
                                {primaryGroupOptions.map((opt) => (
                                    <option key={opt.key} value={opt.key}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label style={{ display: 'block' }}>
                            <span style={labelTextStyle}>Template</span>
                            <select
                                value={templateId}
                                onChange={handleTemplateChange}
                                disabled={!primaryGroupKey}
                                style={{ ...selectStyle, backgroundColor: primaryGroupKey ? 'white' : '#f3f4f6' }}
                            >
                                <option value="">
                                    {primaryGroupKey ? 'Select a template' : 'Select a primary layer first'}
                                </option>
                                {templateOptions.map((template) => (
                                    <option key={template.id} value={template.id}>
                                        {template.shortLabel}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {attributes.template && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#374151', fontStyle: 'italic' }}>
                                Selected: {attributes.template.label}
                            </div>
                        )}
                    </div>

                    <div style={fieldStyle}>
                        <label style={labelStyle}>
                            State Name:
                            <input type="text" name="stateName" value={attributes.stateName} onChange={handleChange} style={inputStyle} required />
                        </label>
                    </div>

                    <div style={fieldStyle}>
                        <label style={labelStyle}>
                            State Number:
                            <input type="text" name="stateNumber" value={attributes.stateNumber} onChange={handleChange} style={inputStyle} />
                        </label>
                    </div>

                    <div style={fieldStyle}>
                        <label style={labelStyle}>
                            Condition class:
                            <select name="vastClass" value={attributes.vastClass} onChange={handleChange} style={selectStyle}>
                                <option value="">Select a class</option>
                                {CONDITION_CLASSES.map((conditionClass) => (
                                    <option key={conditionClass} value={conditionClass}>
                                        {conditionClass}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div style={fieldStyle}>
                        <label htmlFor="condition-lower" style={labelStyle}>Condition Lower Bound:</label>
                        <input
                            type="number"
                            step="0.01"
                            name="conditionLower"
                            id="condition-lower"
                            value={lowerBound}
                            onChange={(e) => {
                                setLowerBound(e.target.value);
                                if (isEditing) {
                                    onPatch?.('conditionLower', e.target.value);
                                }
                            }}
                            style={inputStyle}
                        />
                    </div>

                    <div style={fieldStyle}>
                        <label htmlFor="condition-upper" style={labelStyle}>Condition Upper Bound:</label>
                        <input
                            type="number"
                            step="0.01"
                            name="conditionUpper"
                            id="condition-upper"
                            value={upperBound}
                            onChange={(e) => {
                                setUpperBound(e.target.value);
                                if (isEditing) {
                                    onPatch?.('conditionUpper', e.target.value);
                                }
                            }}
                            style={inputStyle}
                        />
                    </div>

                    {boundsInvalid && lowerBound && upperBound && (
                        <div style={{ color: '#d9534f', marginBottom: 10 }}>
                            Lower Bound must be less than Upper Bound.
                        </div>
                    )}

                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee' }}>
                        <div style={{ marginBottom: 8, fontWeight: 600 }}>Note</div>
                        <textarea
                            name="note"
                            placeholder="Add a brief note about this state"
                            value={attributes.note ?? ''}
                            onChange={handleChange}
                            style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
                        />
                    </div>

                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee' }}>
                        <div style={{ marginBottom: 8, fontWeight: 600 }}>State Images</div>

                        {imageUrls.length > 0 ? (
                            <div style={galleryStyle}>
                                {imageUrls.map((url, index) => (
                                    <div key={`${url.slice(0, 32)}-${index}`} style={thumbWrapStyle}>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewImage(url)}
                                            style={thumbButtonStyle}
                                            title="Preview image"
                                        >
                                            <img src={url} alt={`State preview ${index + 1}`} style={thumbImageStyle} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveImage(index)}
                                            style={removeImageButtonStyle}
                                            title="Remove image"
                                        >
                                            x
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ marginBottom: 10, color: '#666' }}>No image set.</div>
                        )}

                        <label style={{ display: 'block' }}>
                            <span style={{ display: 'block', marginBottom: 6 }}>Upload images:</span>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => {
                                    void handleImageUpload(e.target.files);
                                    e.target.value = '';
                                }}
                                style={{ cursor: 'pointer' }}
                            />
                        </label>
                    </div>

                    <div style={buttonRowStyle}>
                        {isEditing && onDuplicate && (
                            <button type="button" onClick={onDuplicate} style={duplicateButtonStyle}>
                                Duplicate State
                            </button>
                        )}
                        {isEditing && onDelete && (
                            <button type="button" onClick={onDelete} style={deleteButtonStyle}>
                                Delete State
                            </button>
                        )}
                        <button type="button" onClick={onClose} style={secondaryButtonStyle}>
                            Cancel
                        </button>
                        <button type="submit" style={primaryButtonStyle} disabled={boundsInvalid}>
                            {isEditing ? 'Update' : 'Add'}
                        </button>
                    </div>
                </form>

                {previewImage && (
                    <div style={previewOverlayStyle} onClick={() => setPreviewImage(null)}>
                        <div style={previewBoxStyle} onClick={(e) => e.stopPropagation()}>
                            <button type="button" style={previewCloseStyle} onClick={() => setPreviewImage(null)}>x</button>
                            <img src={previewImage} alt="State image preview" style={previewImageStyle} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    width: 430,
    maxWidth: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
};

const sectionStyle: React.CSSProperties = {
    marginBottom: 15,
    padding: 10,
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
};

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 5 };
const labelTextStyle: React.CSSProperties = { display: 'block', marginBottom: 4, fontSize: 13 };
const fieldStyle: React.CSSProperties = { marginBottom: 15 };
const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 8,
    borderRadius: 4,
    border: '1px solid #ccc',
};
const selectStyle: React.CSSProperties = { ...inputStyle, backgroundColor: 'white' };

const galleryStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
    gap: 8,
    marginBottom: 10,
};

const thumbWrapStyle: React.CSSProperties = { position: 'relative' };
const thumbButtonStyle: React.CSSProperties = {
    width: '100%',
    aspectRatio: '1 / 1',
    padding: 0,
    border: '1px solid #ddd',
    borderRadius: 4,
    overflow: 'hidden',
    background: '#f9fafb',
    cursor: 'pointer',
};
const thumbImageStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const removeImageButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    border: 'none',
    borderRadius: 999,
    background: 'rgba(17, 24, 39, 0.78)',
    color: 'white',
    cursor: 'pointer',
    lineHeight: '22px',
    padding: 0,
};

const buttonRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    flexWrap: 'wrap',
};
const secondaryButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 4,
    border: '1px solid #ccc',
    backgroundColor: '#f5f5f5',
    cursor: 'pointer',
};
const primaryButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 4,
    border: 'none',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
};
const deleteButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 4,
    border: '1px solid #cc0000',
    backgroundColor: '#ffeeee',
    color: '#8b0000',
    cursor: 'pointer',
};
const duplicateButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 4,
    border: '1px solid #1d4ed8',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    cursor: 'pointer',
};

const previewOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1300,
};
const previewBoxStyle: React.CSSProperties = {
    position: 'relative',
    maxWidth: '82vw',
    maxHeight: '82vh',
    background: '#111827',
    borderRadius: 8,
    padding: 10,
};
const previewCloseStyle: React.CSSProperties = {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 28,
    height: 28,
    borderRadius: 999,
    border: 'none',
    background: '#fff',
    cursor: 'pointer',
};
const previewImageStyle: React.CSSProperties = {
    maxWidth: '78vw',
    maxHeight: '78vh',
    objectFit: 'contain',
    display: 'block',
};
