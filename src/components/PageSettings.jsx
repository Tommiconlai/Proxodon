import { PAPER_FORMATS, getGridInfo } from '../utils/pdfGenerator';
import { BUNDLED_PROFILES, UPLOAD_ID } from '../utils/iccProfiles';

const DPI_OPTIONS = [150, 300, 600, 800, 1000, 1200];
const BLEED_OPTIONS = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
const BLEED_STYLE_OPTIONS = [
    { value: 'auto', label: 'Auto (per card)' },
    { value: 'mirror', label: 'Mirror' },
    { value: 'stretch', label: 'Stretch' },
    { value: 'black', label: 'Black' },
    { value: 'full', label: 'Bleed in art' },
];
// Preset dimensioni carta in mm. 'custom' → input liberi.
const CARD_TYPES = [
    { key: 'mtg', label: 'Standard, 63×88', w: 63, h: 88 },
    { key: 'small', label: 'Small / JP, 59×86', w: 59, h: 86 },
    { key: 'mini', label: 'Mini USA, 41×63', w: 41, h: 63 },
    { key: 'tarot', label: 'Tarot, 70×120', w: 70, h: 120 },
    { key: 'custom', label: 'Custom…', w: 0, h: 0 },
];

// Input numerico → numero finito (campo svuotato = 0, non NaN: evita "NaN×NaN" e
// griglia NaN a valle; lo 0 fa scattare l'avviso "foglio troppo piccolo").
const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// Label-sopra + select. aria-label associa il nome al control (niente <label for>).
function SelectField({ label, value, onChange, children }) {
    return (
        <div className="field">
            <span className="field-label">{label}</span>
            <div className="select-wrapper">
                <select value={value} onChange={onChange} aria-label={label}>{children}</select>
            </div>
        </div>
    );
}

export default function PageSettings({
    formatKey, setFormatKey, bleedMm, setBleedMm, bleedStyle, setBleedStyle, dpi, setDpi,
    cardType, setCardType, cardW, setCardW, cardH, setCardH,
    cropMarks, setCropMarks, cropStyle, setCropStyle,
    sheetUnit, setSheetUnit, sheetW, setSheetW, sheetH, setSheetH, customSheet,
    lowResCount = 0, quality = 0.85, setQuality,
    colorMode = 'rgb', setColorMode, renderIntent = 'relative', setRenderIntent,
    iccProfileId = 'fogra39', setIccProfileId, uploadedIcc = null, onIccUpload, onIccClear,
    profileMismatchCount = 0,
}) {
    const { cols, rows, perPage } = getGridInfo(formatKey, bleedMm, cardW, cardH, customSheet);
    const [pw, ph] = formatKey === 'custom' && customSheet
        ? customSheet.map((v) => Math.round(v * 10) / 10)
        : PAPER_FORMATS[formatKey];
    const totalWmm = (cardW + bleedMm * 2).toFixed(1);
    const totalHmm = (cardH + bleedMm * 2).toFixed(1);

    const onTypeChange = (key) => {
        setCardType(key);
        const t = CARD_TYPES.find((c) => c.key === key);
        if (t && key !== 'custom') { setCardW(t.w); setCardH(t.h); }
    };

    // Cambio unità foglio: converte i valori mostrati (mm↔inch) mantenendo la misura.
    // Alta precisione (in: 3 decimali, mm: 2) così avanti-e-indietro non fa derivare
    // la dimensione di frazioni di mm a ogni toggle.
    const onUnitChange = (u) => {
        if (u === sheetUnit) return;
        const conv = (v) => (u === 'in' ? Math.round((v / 25.4) * 1000) / 1000 : Math.round(v * 25.4 * 100) / 100);
        setSheetW(conv(sheetW));
        setSheetH(conv(sheetH));
        setSheetUnit(u);
    };

    return (
        <>
            {/* Gruppo 1, Foglio & carta */}
            <div className="sidebar-section">
                <h2>Sheet &amp; card</h2>
                <div className="glass-card compact settings-group">
                    <div className="field">
                        <span className="field-label">Sheet format</span>
                        <div className="select-wrapper">
                            <select value={formatKey} onChange={e => setFormatKey(e.target.value)} aria-label="Sheet format">
                                {Object.keys(PAPER_FORMATS).map(k => {
                                    const [w, h] = PAPER_FORMATS[k];
                                    return <option key={k} value={k}>{k}, {w}×{h} mm</option>;
                                })}
                                <option value="custom">Custom…</option>
                            </select>
                        </div>
                        {formatKey === 'custom' && (
                            <>
                                <div className="unit-toggle">
                                    <button type="button" className={sheetUnit === 'mm' ? 'active' : ''} onClick={() => onUnitChange('mm')}>mm</button>
                                    <button type="button" className={sheetUnit === 'in' ? 'active' : ''} onClick={() => onUnitChange('in')}>inch</button>
                                </div>
                                <div className="card-size-custom">
                                    <label>W
                                        <input type="number" min="1" step={sheetUnit === 'in' ? '0.1' : '1'}
                                            value={sheetW} onChange={e => setSheetW(toNum(e.target.value))} />
                                        {sheetUnit}
                                    </label>
                                    <label>H
                                        <input type="number" min="1" step={sheetUnit === 'in' ? '0.1' : '1'}
                                            value={sheetH} onChange={e => setSheetH(toNum(e.target.value))} />
                                        {sheetUnit}
                                    </label>
                                </div>
                                {customSheet && (customSheet[0] < cardW || customSheet[1] < cardH) && (
                                    <div className="lowres-warn">
                                        <span className="lowres-mark" aria-hidden="true">!</span>
                                        <span>Sheet smaller than the {cardW}×{cardH}&nbsp;mm card. No cards will fit. Increase the sheet, or reduce the card size.</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="field">
                        <span className="field-label">Card type</span>
                        <div className="select-wrapper">
                            <select value={cardType} onChange={e => onTypeChange(e.target.value)} aria-label="Card type">
                                {CARD_TYPES.map(t => (
                                    <option key={t.key} value={t.key}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        {cardType === 'custom' && (
                            <div className="card-size-custom">
                                <label>W
                                    <input type="number" min="20" max="200" step="0.5"
                                        value={cardW} onChange={e => setCardW(toNum(e.target.value))} />
                                    mm
                                </label>
                                <label>H
                                    <input type="number" min="20" max="200" step="0.5"
                                        value={cardH} onChange={e => setCardH(toNum(e.target.value))} />
                                    mm
                                </label>
                            </div>
                        )}
                    </div>

                    <SelectField label="Bleed" value={bleedMm} onChange={e => setBleedMm(parseFloat(e.target.value))}>
                        {BLEED_OPTIONS.map(v => (
                            <option key={v} value={v}>{v.toFixed(1)} mm</option>
                        ))}
                    </SelectField>
                    <p className="field-hint">Extra art printed past the cut line so no white edges show after trimming.</p>
                </div>
            </div>

            {/* Gruppo 2, Stampa */}
            <div className="sidebar-section">
                <h2>Print</h2>
                <div className="glass-card compact settings-group">
                    {/* Output colore: RGB (schermo, jsPDF) | CMYK (stampa, PDF/X-1a) */}
                    <div className="field">
                        <SelectField label="Output" value={colorMode} onChange={e => setColorMode(e.target.value)}>
                            <option value="rgb">RGB (screen)</option>
                            <option value="cmyk">CMYK (print), PDF/X-1a</option>
                        </SelectField>
                        {colorMode === 'rgb' && (
                            <p className="field-hint">RGB suits home &amp; online printing; choose CMYK only for a professional print shop.</p>
                        )}
                        {colorMode === 'cmyk' && (
                            <div className="cmyk-box">
                                <span className="cmyk-tag">PDF/X-1a:2003 · DeviceCMYK · embedded ICC</span>
                                {/* Profilo ICC: incluso (default pronto) o caricato dall'utente */}
                                <SelectField label="ICC profile" value={iccProfileId} onChange={e => setIccProfileId(e.target.value)}>
                                    {BUNDLED_PROFILES.map(p => (
                                        <option key={p.id} value={p.id}>{p.label}</option>
                                    ))}
                                    <option value={UPLOAD_ID}>Upload custom .icc…</option>
                                </SelectField>
                                {iccProfileId === UPLOAD_ID && (
                                    <>
                                        <div className="icc-row">
                                            <label className="btn-icc">
                                                <input type="file" accept=".icc,.icm" hidden
                                                    onChange={e => { const f = e.target.files?.[0]; if (f) onIccUpload?.(f); e.target.value = ''; }} />
                                                {uploadedIcc ? 'Change ICC…' : 'Load .icc / .icm…'}
                                            </label>
                                            {uploadedIcc && (
                                                <button type="button" className="icc-clear" onClick={() => onIccClear?.()} aria-label="Remove ICC profile">×</button>
                                            )}
                                        </div>
                                        {uploadedIcc
                                            ? <p className="field-hint icc-ok">✓ {uploadedIcc.name}</p>
                                            : <p className="field-hint">Ask your print shop for their CMYK <b>output</b> profile (an <code>.icc</code> / <code>.icm</code> file). The bundled FOGRA profiles above already cover most EU/US offset shops. DeviceLink or abstract profiles are rejected.</p>}
                                    </>
                                )}
                                {profileMismatchCount > 0 && (
                                    <div className="lowres-warn">
                                        <span className="lowres-mark" aria-hidden="true">!</span>
                                        <span>
                                            {profileMismatchCount} native CMYK card{profileMismatchCount > 1 ? 's were' : ' was'} built for a different
                                            CMYK profile than the one selected. To keep the exact ink values {profileMismatchCount > 1 ? 'they’re' : 'it’s'} exported
                                            as-is (no conversion). If the print looks off, ask your shop to re-export in your selected profile, or switch the profile above to match.
                                        </span>
                                    </div>
                                )}
                                <SelectField label="Rendering intent" value={renderIntent} onChange={e => setRenderIntent(e.target.value)}>
                                    <option value="relative">Relative Colorimetric + BPC (default)</option>
                                    <option value="perceptual">Perceptual</option>
                                </SelectField>
                                <p className="field-hint">
                                    How RGB art is mapped into CMYK. <b>Relative Colorimetric + BPC</b> (default) keeps in-gamut
                                    colours exact and uses Black Point Compensation (BPC) to preserve shadow detail;
                                    {' '}<b>Perceptual</b> gently compresses all colours to fit. Affects only RGB art (Scryfall / RGB
                                    uploads). Native CMYK JPEGs pass through untouched. Your print shop may prefer one.
                                </p>
                                <p className="field-hint">Note: the on-screen preview is RGB. Very saturated colours print less vivid in CMYK (smaller gamut), that’s normal.</p>
                            </div>
                        )}
                    </div>

                    <div className="field">
                        <SelectField label="Bleed style" value={bleedStyle} onChange={e => setBleedStyle(e.target.value)}>
                            {BLEED_STYLE_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </SelectField>
                        {bleedStyle === 'full' && (
                            <p className="field-hint">
                                Cards are drawn edge-to-edge (no bleed generated) - for art that already
                                includes bleed. Set <b>Bleed</b> to the baked amount (e.g. 2&nbsp;mm) so crop
                                marks land on the trim.
                            </p>
                        )}
                    </div>

                    {lowResCount > 0 && (
                        <div className="lowres-warn">
                            <span className="lowres-mark" aria-hidden="true">!</span>
                            <span>
                                {lowResCount} card{lowResCount > 1 ? 's' : ''} {lowResCount > 1 ? 'have' : 'has'} under half the pixels {dpi} DPI needs at
                                card size. {lowResCount > 1 ? 'They' : 'It'}’ll print soft. Lower the DPI or use higher-res art.
                                Flagged with a <b>!</b> on the card in the preview.
                            </span>
                        </div>
                    )}

                    <SelectField label="Resolution" value={dpi} onChange={e => setDpi(parseInt(e.target.value, 10))}>
                        {DPI_OPTIONS.map(v => (
                            <option key={v} value={v}>{v} DPI</option>
                        ))}
                    </SelectField>
                    <p className="field-hint">Print sharpness. 300 DPI is the standard. Source art should be about that at card size (a 63×88&nbsp;mm card ≈ 745&nbsp;px wide). Higher DPI only helps if the art is high-res.</p>

                    {/* Compressione JPEG dell'export RGB (non si applica al CMYK lossless) */}
                    <div className="field">
                        <div className="range-head">
                            <span className="field-label">Compression</span>
                            <span className="range-value">{Math.round(quality * 100)}% quality</span>
                        </div>
                        <input
                            type="range" min="30" max="100" step="5"
                            value={Math.round(quality * 100)}
                            onChange={e => setQuality(parseInt(e.target.value, 10) / 100)}
                            aria-label="JPEG quality (compression)"
                            style={{ '--fill': `${((Math.round(quality * 100) - 30) / 70) * 100}%` }}
                        />
                        <p className="field-hint">
                            {colorMode === 'cmyk'
                                ? 'Applies to RGB output only. CMYK export is lossless (FlateDecode).'
                                : 'Lower quality = smaller PDF, more JPEG artifacts. 85% is a good default.'}
                        </p>
                    </div>

                    <div className="field">
                        <label className="checkbox-row">
                            <input type="checkbox" checked={cropMarks} onChange={e => setCropMarks(e.target.checked)} />
                            <span className="anim-check" aria-hidden="true">
                                <svg width="18" height="18" viewBox="0 0 18 18">
                                    <path d="M 1 9 L 1 9 c 0 -5 3 -8 8 -8 L 9 1 C 14 1 17 5 17 9 L 17 9 c 0 4 -4 8 -8 8 L 9 17 C 5 17 1 14 1 9 L 1 9 Z" />
                                    <polyline points="1 9 7 14 15 4" />
                                </svg>
                            </span>
                            <span>Show crop marks</span>
                        </label>
                        <p className="field-hint">Thin guides showing where to cut each card.</p>
                        {cropMarks && (
                            <div className="select-wrapper" style={{ marginTop: 10 }}>
                                <select value={cropStyle} onChange={e => setCropStyle(e.target.value)} aria-label="Crop mark style">
                                    <option value="lines">Lines</option>
                                    <option value="corners">Corner brackets</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Riepilogo */}
            <div className="sidebar-section">
                <h2>Summary</h2>
                <div className="info-box">
                    <strong>Sheet:</strong> {pw}×{ph} mm<br />
                    <strong>Card:</strong> {cardW}×{cardH} mm<br />
                    <strong>Cell:</strong> {totalWmm}×{totalHmm} mm<br />
                    <strong>Grid:</strong> {cols}×{rows} · {perPage}/page
                </div>
            </div>
        </>
    );
}
