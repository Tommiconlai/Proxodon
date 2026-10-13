import { useState, useEffect } from 'react';
import { Wordmark, IconFile, IconDownload, IconList, IconTrash, IconPlus, IconImage, IconX } from './icons';
import PageSettings from './PageSettings';
import PagePreview from './PagePreview';
import ExportProgress from './ExportProgress';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';

// Icona "sliders" per Settings (inline; stesso stile della vecchia tab bar).
function IconSliders({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="9" cy="8" r="2" fill="var(--bg-base)" /><circle cx="15" cy="16" r="2" fill="var(--bg-base)" />
    </svg>
  );
}

// Pagina overlay full-screen (Settings / Export): si apre dal basso, header + chiudi.
// Sostituisce le vecchie tab: Settings/Export ora aprono una "pagina", come l'add-sheet.
export function MobilePage({ title, onClose, children }) {
  const dismissRef = useOverlayDismiss(onClose); // Esc chiude + focus nella pagina
  return (
    <div className="mobile-page" ref={dismissRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}>
      <header className="mobile-page-header">
        <h2>{title}</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
      </header>
      <div className="mobile-page-body">{children}</div>
    </div>
  );
}

export default function MobileLayout({ settingsProps, previewProps, actions, addMenu }) {
  const [addOpen, setAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [page, setPage] = useState(null); // null | 'settings' | 'export'

  // Esc chiude i due overlay inline (add-sheet, tooltip ?). Gli altri (menu carta,
  // MobilePage) hanno il loro useOverlayDismiss. Se una pagina è SOPRA (page),
  // l'Esc spetta a quella: qui non si chiude nulla, così un solo Esc non chiude due layer.
  useEffect(() => {
    if ((!addOpen && !helpOpen) || page) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setAddOpen(false); setHelpOpen(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [addOpen, helpOpen, page]);

  return (
    <div className="mobile">
      <header className="mobile-header">
        <h1 className="brand"><Wordmark height={26} className="wordmark" /></h1>
        {/* Pulsante ? con tap-toggle su mobile, riusa lo stesso markup del desktop */}
        <div className={`help${helpOpen ? ' open' : ''}`}>
          <button type="button" className="help-btn" aria-label="How it works" onClick={() => setHelpOpen((o) => !o)}>?</button>
          <div className="help-tooltip" role="tooltip">
            <button type="button" className="help-tooltip-close" aria-label="Close help" onClick={() => setHelpOpen(false)}>✕</button>
            <strong>How it works</strong>
            <ol>
              <li><b>Add cards</b>. Tap <b>＋</b> to upload images or import from Scryfall (a card list or a deck link).</li>
              <li><b>Set up</b>. Tap <b>Settings</b> (bottom-left): sheet &amp; card size, bleed, crop marks, CMYK.</li>
              <li><b>Tweak</b>. Select as many cards as you like, then use the menu: change art, duplicate, bleed, remove. With several selected the menu acts on all of them.</li>
              <li><b>Export</b>. Tap <b>Export</b> (bottom-right) for <b>Generate PDF</b>; <b>Save list</b> exports your Scryfall cards as a reloadable deck list.</li>
            </ol>
            <p className="help-controls"><b>Tap</b> select or deselect · <b>Long-press</b> options</p>
          </div>
        </div>
      </header>

      <main className="mobile-body">
        <div className="mobile-cards">
          <PagePreview {...previewProps} touch />
          {/* Barra inferiore (sostituisce la tab bar): Settings · [Elimina · ＋ · Salva] · Export */}
          <div className="cards-toolbar">
            <button className="ct-nav" onClick={() => setPage('settings')} aria-label="Settings">
              <IconSliders /><span>Settings</span>
            </button>
            <div className="ct-cluster">
              <div className="ct-item">
                <button className="ct-btn ct-danger" onClick={actions.onClear} disabled={actions.count === 0} aria-label="Delete all"><IconTrash size={20} /></button>
                <span className="ct-lbl">Delete</span>
              </div>
              <div className="ct-item">
                <button className="fab" onClick={() => setAddOpen(true)} aria-label="Add cards"><IconPlus size={26} /></button>
                <span className="ct-lbl">Add</span>
              </div>
              <div className="ct-item">
                <button className="ct-btn ct-save" onClick={actions.onSave} disabled={actions.count === 0} aria-label="Save list"><IconList size={20} /></button>
                <span className="ct-lbl">Save</span>
              </div>
            </div>
            <button className="ct-nav" onClick={() => setPage('export')} aria-label="Export PDF">
              <IconFile size={22} /><span>Export</span>
            </button>
          </div>

          {addOpen && (
            <div className="sheet-overlay" onClick={() => setAddOpen(false)}>
              <div className="sheet" onClick={(e) => e.stopPropagation()} role="menu">
                <div className="sheet-handle" />
                <label role="menuitem" className="sheet-upload">
                  <input type="file" accept="image/*" multiple hidden
                    onChange={(e) => { const fs = [...e.target.files]; e.target.value = ''; setAddOpen(false); if (fs.length) addMenu.onFiles(fs); }} />
                  <IconImage size={18} /> Upload files
                </label>
                <button role="menuitem" onClick={() => { setAddOpen(false); addMenu.onImport(); }}><IconDownload size={18} /> Import from Scryfall</button>
                <button role="menuitem" onClick={() => { setAddOpen(false); addMenu.onImportMpc(); }}><IconFile size={18} /> Import from MPCFill</button>
              </div>
            </div>
          )}
        </div>
      </main>

      {page === 'settings' && (
        <MobilePage title="Settings" onClose={() => setPage(null)}>
          <PageSettings {...settingsProps} />
        </MobilePage>
      )}
      {page === 'export' && (
        <MobilePage title="Export" onClose={() => setPage(null)}>
          <div className="mobile-export">
            <div className="export-summary">
              <strong>{actions.count}</strong> card{actions.count !== 1 ? 's' : ''}
              {actions.missing > 0 && <span> · {actions.missing} to fill the page</span>}
            </div>
            {actions.lowResCount > 0 && (
              <div className="lowres-warn"><span className="lowres-mark" aria-hidden="true">!</span>
                <span>{actions.lowResCount} card{actions.lowResCount > 1 ? 's' : ''} too low-res for {actions.dpi} DPI. Lower the DPI or use higher-res art.</span></div>
            )}
            <ExportProgress loading={actions.loading} progress={actions.genProgress} disabled={actions.count === 0}
              onGenerate={actions.onGenerate} onCancel={actions.onCancelGenerate} />
            <p className="field-hint">Use <b>Save list</b> (bottom bar) to export your Scryfall cards as a reloadable deck list.</p>
            {actions.error && (
              <div className="info-box info-box-error">
                <span>{actions.error}</span>
                <button type="button" className="info-box-dismiss" onClick={actions.onClearError} aria-label="Dismiss error">
                  <IconX size={14} />
                </button>
              </div>
            )}
          </div>
        </MobilePage>
      )}
    </div>
  );
}
