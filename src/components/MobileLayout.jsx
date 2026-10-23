import { useState, useEffect } from 'react';
import { IconFile, IconDownload, IconImage, IconX, IconNavAdd, IconNavSettings, IconNavExport } from './icons';
import MobileNav from './MobileNav';
import PageSettings from './PageSettings';
import PagePreview from './PagePreview';
import ExportProgress from './ExportProgress';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { useBackClose } from '../hooks/useBackClose';
import HelpTour from '../tutorial/HelpTour';

// Pagina overlay full-screen (Settings / Export, dalla barra in cima a Print): si apre dal basso, header + chiudi.
export function MobilePage({ title, onClose, children }) {
  const dismissRef = useOverlayDismiss(onClose); // Esc chiude + focus nella pagina
  return (
    <div className="mobile-page" ref={dismissRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}>
      <header className="mobile-page-header">
        <h2>{title}</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close" title="Close">✕</button>
      </header>
      <div className="mobile-page-body">{children}</div>
    </div>
  );
}

// Telefono e tablet in verticale: niente testata; in basso il menu della X (MobileNav) con le pagine, il ? e il profilo.
// Print: in cima il titolo e la barra Add cards / Settings / Export (lo stile della ricerca dei mazzi), poi il foglio.
// Area mazzi (altBody): ? e avatar arrivano da DecksView nel portale headerSlot, dentro il menu. extras = gli angoli del
// menu per un'altra pagina in altBody (Tokens: solo l'avatar).
export default function MobileLayout({ settingsProps, previewProps, actions, addMenu, route, altBody, headerSlot, account, extras }) {
  const [addOpen, setAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [page, setPage] = useState(null); // null | 'settings' | 'export'
  // Back del sistema chiude anche i due overlay inline (le pagine hanno il loro, in MobilePage).
  useBackClose(addOpen, () => setAddOpen(false));
  useBackClose(helpOpen, () => setHelpOpen(false));

  // Esc chiude i due overlay inline (add-sheet, tooltip ?). Gli altri (menu carta,
  // MobilePage) hanno il loro useOverlayDismiss. Se una pagina è SOPRA (page),
  // l'Esc spetta a quella: qui non si chiude nulla, così un solo Esc non chiude due layer.
  useEffect(() => {
    if ((!addOpen && !helpOpen) || page) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setAddOpen(false); setHelpOpen(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [addOpen, helpOpen, page]);

  // Pulsante ? della stampa (tap-toggle), nel menu della X: stesso markup del desktop.
  const help = (
    <div className={`help${helpOpen ? ' open' : ''}`}>
      <button type="button" className="help-btn" aria-label="How it works" title="How it works" onClick={() => setHelpOpen((o) => !o)}>?</button>
      <div className="help-tooltip" role="tooltip">
        <button type="button" className="help-tooltip-close" aria-label="Close help" title="Close help" onClick={() => setHelpOpen(false)}>✕</button>
        <strong>How it works</strong>
        <ol>
          <li><b>Add cards</b>. Tap <b>＋</b> at the top to upload images or import from Scryfall (a card list).</li>
          <li><b>Set up</b>. <b>Settings</b> (the sliders at the top): sheet &amp; card size, bleed, crop marks, CMYK.</li>
          <li><b>Tweak</b>. Select as many cards as you like, then long-press for the menu: change art, duplicate, bleed, remove. With several selected the menu acts on all of them.</li>
          <li><b>Export</b>. <b>Export</b> (the PDF at the top right) for <b>Generate PDF</b>.</li>
        </ol>
        <p className="help-controls"><b>Tap</b> select or deselect · <b>Long-press</b> options</p>
        <HelpTour onStart={() => setHelpOpen(false)} />
      </div>
    </div>
  );

  return (
    <div className="mobile">

      {altBody
        ? <main className="mobile-body mobile-decks">{altBody}</main>
        : (
          <main className="mobile-body">
            <div className="mobile-cards">
              <div className="print-top">
                <header className="decks-head"><h1 className="decks-title">Print</h1></header>
                <div className="print-actions">
                  <button type="button" className="decks-filter-btn" onClick={() => setAddOpen(true)} aria-label="Add cards" title="Add cards"><IconNavAdd size={20} /></button>
                  <button type="button" className="decks-filter-btn" onClick={() => setPage('settings')} aria-label="Settings" title="Settings"><IconNavSettings size={20} /></button>
                  <button type="button" className="decks-filter-btn" onClick={() => setPage('export')} aria-label="Export" title="Export"><IconNavExport size={20} /></button>
                </div>
              </div>
              <PagePreview {...previewProps} touch />

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
        )}

      <MobileNav route={route}>{extras ?? (altBody ? <div className="header-slot" ref={headerSlot} /> : <>{help}{account}</>)}</MobileNav>

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
            {actions.error && (
              <div className="info-box info-box-error">
                <span>{actions.error}</span>
                <button type="button" className="info-box-dismiss" onClick={actions.onClearError} aria-label="Dismiss error" title="Dismiss error">
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
