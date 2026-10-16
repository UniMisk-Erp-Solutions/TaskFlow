import React, { useEffect, useRef, useState } from 'react';
import { Download, File as FileIcon, X } from 'lucide-react';
import { fetchFileBlob, fileErrorMessage, previewKind, saveBlob } from '../lib/fileAccess';

/**
 * In-app viewer. `source` = { path, params?, name, contentType, size }.
 * Images, PDFs, video, audio and plain text open inline; anything else offers a download.
 */
export default function FilePreviewModal({ source, onClose }) {
  const kind = source ? previewKind(source.contentType, source.name, source.size) : null;
  const [state, setState] = useState({ status: 'loading', url: '', text: '', blob: null, error: '', progress: 0 });
  const urlRef = useRef('');

  useEffect(() => {
    if (!source) return undefined;
    let cancelled = false;
    setState({ status: 'loading', url: '', text: '', blob: null, error: '', progress: 0 });
    (async () => {
      try {
        const blob = await fetchFileBlob(source.path, source.params, (e) => {
          if (!cancelled && e.total) setState((s) => ({ ...s, progress: Math.round((e.loaded / e.total) * 100) }));
        });
        if (cancelled) return;
        if (kind === 'text') {
          const text = await blob.text();
          if (!cancelled) setState({ status: 'ready', url: '', text, blob, error: '', progress: 100 });
        } else {
          let typed = blob;
          if (kind === 'pdf' && blob.type !== 'application/pdf') typed = new Blob([blob], { type: 'application/pdf' });
          const url = kind ? URL.createObjectURL(typed) : '';
          urlRef.current = url;
          setState({ status: 'ready', url, text: '', blob: typed, error: '', progress: 100 });
        }
      } catch (err) {
        const message = await fileErrorMessage(err, 'Could not open the file.');
        if (!cancelled) setState((s) => ({ ...s, status: 'error', error: message }));
      }
    })();
    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = '';
    };
  }, [source?.path, JSON.stringify(source?.params || {}), kind]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!source) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [source, onClose]);

  if (!source) return null;

  const download = () => {
    if (state.blob) saveBlob(state.blob, source.name);
  };

  return (
    <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal fx-preview" role="dialog" aria-modal="true" aria-label={`Preview of ${source.name}`}>
        <div className="fx-preview-head">
          <strong title={source.name}>{source.name}</strong>
          <div className="fx-preview-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={download} disabled={state.status !== 'ready'}><Download size={14} /> Download</button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close preview"><X size={16} /></button>
          </div>
        </div>
        <div className="fx-preview-body">
          {state.status === 'loading' && (
            <div className="fx-preview-center"><span className="spinner" /><span>Loading{state.progress ? ` ${state.progress}%` : '…'}</span></div>
          )}
          {state.status === 'error' && <div className="fx-preview-center fx-preview-error">{state.error}</div>}
          {state.status === 'ready' && kind === 'image' && <img src={state.url} alt={source.name} />}
          {state.status === 'ready' && kind === 'pdf' && <iframe title={source.name} src={state.url} />}
          {state.status === 'ready' && kind === 'video' && <video src={state.url} controls autoPlay={false} />}
          {state.status === 'ready' && kind === 'audio' && <audio src={state.url} controls style={{ width: '100%' }} />}
          {state.status === 'ready' && kind === 'text' && <pre>{state.text}</pre>}
          {state.status === 'ready' && !kind && (
            <div className="fx-preview-center">
              <FileIcon size={40} />
              <p>This file type cannot be previewed in the browser.</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={download}><Download size={14} /> Download file</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
