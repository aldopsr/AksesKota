import { useEffect } from 'react';

// title === null: jangan ubah (dipakai halaman yang judulnya diatur komponen anak)
export function useDocumentTitle(title) {
  useEffect(() => {
    if (title === null) return;
    document.title = title ? `${title} - AksesKota` : 'AksesKota';
  }, [title]);
}
