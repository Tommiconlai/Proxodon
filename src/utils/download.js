// Salva un file: link temporaneo con download.
export async function saveFile(filename, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Non subito: Firefox e Safari possono leggere il blob dopo il click (un PDF grande si interromperebbe).
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

// Scarica un testo come file (export del mazzo, backup dei mazzi, lista della stampa).
export const downloadText = (filename, text, type = 'text/plain') => saveFile(filename, new Blob([text], { type }));
