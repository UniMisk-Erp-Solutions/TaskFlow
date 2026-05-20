import React, { useMemo, useRef, useState } from 'react';
import { X, UploadCloud, Download, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../api';
import {
  parseCsv, canonicalRow, detectMappedHeaders, previewValidate,
  templateCsv, downloadCsv,
} from '../lib/csvImport';

/**
 * Admin-only bulk CSV import for tasks OR meetings.
 *
 *   <CsvImportModal kind="task" open={…} onClose={…} onImported={refetch} />
 *
 * Flow: drop CSV → smart-parse → side-by-side preview of detected columns and
 * a per-row validation badge → admin confirms → POST to /tasks/import or
 * /meetings/import → result screen with created / skipped counts.
 */
export default function CsvImportModal({ kind = 'task', open, onClose, onImported }) {
  const [filename, setFilename] = useState('');
  const [rawText, setRawText] = useState('');
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState(null); // { total, created, skipped, errors }
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const parsed = useMemo(() => {
    if (!rawText) return null;
    try { return parseCsv(rawText); } catch (e) { setError(e.message); return null; }
  }, [rawText]);

  const mapped = useMemo(() => (parsed ? detectMappedHeaders(parsed.header, kind) : {}), [parsed, kind]);

  const preview = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((row, idx) => {
      const c = canonicalRow(row, kind);
      const v = previewValidate(c, kind);
      return { row: idx + 2, canonical: c, ...v };
    });
  }, [parsed, kind]);

  const okCount = preview.filter((r) => r.ok).length;
  const badCount = preview.length - okCount;

  if (!open) return null;

  function reset() {
    setRawText('');
    setFilename('');
    setResult(null);
    setError('');
  }

  async function handleFile(file) {
    if (!file) return;
    setFilename(file.name || 'imported.csv');
    setError('');
    setResult(null);
    const text = await file.text();
    setRawText(text);
  }

  async function handleImport() {
    if (!parsed?.rows?.length) return;
    setPosting(true);
    setError('');
    try {
      const endpoint = kind === 'task' ? '/tasks/import' : '/meetings/import';
      const { data } = await api.post(endpoint, {
        filename,
        rows: parsed.rows,
      });
      setResult(data);
      if (data?.created > 0) onImported?.();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="overlay" role="presentation">
      <div className="modal" style={{ maxWidth: 720 }} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            Import {kind === 'task' ? 'tasks' : 'meetings'} from CSV
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-muted)', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {result ? (
          <ResultView result={result} kind={kind} onReset={reset} onClose={onClose} />
        ) : (
          <>
            {/* Drop zone */}
            {!rawText && (
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                style={{
                  border: '2px dashed var(--tf-border)',
                  borderRadius: 14,
                  padding: '36px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--tf-pearl)',
                  transition: 'border-color 120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--tf-border)'; }}
              >
                <UploadCloud size={28} style={{ color: 'var(--color-primary)', margin: '0 auto 8px' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-text)' }}>
                  Drop a CSV here or click to pick a file
                </div>
                <div style={{ fontSize: 12, color: 'var(--tf-muted)', marginTop: 4 }}>
                  Columns can be in any order. We auto-detect title / description / priority / dates / assignees / project.
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadCsv(`${kind}_template.csv`, templateCsv(kind));
                    }}
                  >
                    <Download size={13} /> Download template
                  </button>
                </div>
              </div>
            )}

            {/* Parsed preview */}
            {rawText && parsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* File row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--tf-border)', borderRadius: 10, background: 'var(--tf-pearl)' }}>
                  <FileText size={16} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--tf-text)', fontWeight: 500 }}>
                    {filename || 'pasted.csv'} · {parsed.rows.length} row{parsed.rows.length !== 1 ? 's' : ''}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Change file</button>
                </div>

                {/* Mapping summary */}
                <div style={{ border: '1px solid var(--tf-border)', borderRadius: 10, padding: 12, background: 'var(--tf-panel)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    Detected columns
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                    {Object.entries(mapped).map(([field, header]) => (
                      <div key={field} style={{ fontSize: 12, lineHeight: 1.4 }}>
                        <span style={{ color: 'var(--tf-muted)' }}>{field}</span>
                        <div style={{ color: header ? 'var(--tf-text)' : 'var(--status-danger)', fontWeight: 500 }}>
                          {header || '— not found —'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Counts */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <CountPill color="#1aae39" label={`${okCount} ready`} icon={<CheckCircle2 size={13} />} />
                  {badCount > 0 && <CountPill color="#dd5b00" label={`${badCount} need attention`} icon={<AlertTriangle size={13} />} />}
                </div>

                {/* Row preview table */}
                <div style={{ border: '1px solid var(--tf-border)', borderRadius: 10, overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ background: 'var(--tf-pearl)' }}>
                      <tr style={{ borderBottom: '1px solid var(--tf-border)' }}>
                        <th style={th}>#</th>
                        <th style={th}>Title</th>
                        <th style={th}>{kind === 'task' ? 'Due' : 'When'}</th>
                        <th style={th}>Assignees</th>
                        <th style={th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 80).map((r) => (
                        <tr key={r.row} style={{ borderBottom: '1px solid var(--color-divider-soft)' }}>
                          <td style={td}>{r.row}</td>
                          <td style={td}>{r.canonical.title || <span style={{ color: 'var(--tf-muted)' }}>—</span>}</td>
                          <td style={td}>
                            {kind === 'task'
                              ? [r.canonical.due_date, r.canonical.due_time].filter(Boolean).join(' · ')
                              : [r.canonical.meeting_date, r.canonical.meeting_time].filter(Boolean).join(' · ')}
                          </td>
                          <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.canonical.assignees}
                          </td>
                          <td style={td}>
                            {r.ok
                              ? <span style={{ color: '#1aae39', fontWeight: 600 }}>Ready</span>
                              : <span style={{ color: 'var(--status-danger)', fontWeight: 600 }} title={r.reason}>{r.reason}</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 80 && (
                    <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--tf-muted)', textAlign: 'center', background: 'var(--tf-pearl)' }}>
                      …and {preview.length - 80} more. All rows will be imported.
                    </div>
                  )}
                </div>

                {error && <div className="form-error">{error}</div>}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleImport}
                    disabled={posting || okCount === 0}
                    title={okCount === 0 ? 'No valid rows to import' : ''}
                  >
                    {posting
                      ? <span className="spinner" />
                      : `Import ${okCount} ${kind === 'task' ? 'task' : 'meeting'}${okCount === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CountPill({ color, label, icon }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999,
      background: `${color}1A`, color, border: `1px solid ${color}33`,
      fontSize: 12, fontWeight: 600,
    }}>
      {icon}{label}
    </span>
  );
}

function ResultView({ result, kind, onReset, onClose }) {
  const noun = kind === 'task' ? 'task' : 'meeting';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        textAlign: 'center', padding: '18px 16px',
        background: result.created > 0 ? 'rgba(26,174,57,0.10)' : 'var(--tf-pearl)',
        border: `1px solid ${result.created > 0 ? 'rgba(26,174,57,0.25)' : 'var(--tf-border)'}`,
        borderRadius: 12,
      }}>
        <CheckCircle2 size={32} color={result.created > 0 ? '#1aae39' : 'var(--tf-muted)'} style={{ margin: '0 auto 6px' }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--tf-text)' }}>
          {result.created > 0
            ? `Imported ${result.created} ${noun}${result.created === 1 ? '' : 's'}`
            : 'No rows were imported.'}
        </div>
        {result.skipped > 0 && (
          <div style={{ fontSize: 13, color: 'var(--status-warning)', marginTop: 4 }}>
            {result.skipped} skipped — see details below
          </div>
        )}
      </div>

      {result.errors?.length > 0 && (
        <div style={{ border: '1px solid var(--tf-border)', borderRadius: 10, overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
          <div style={{ padding: '8px 12px', background: 'var(--tf-pearl)', fontSize: 12, fontWeight: 600, color: 'var(--tf-muted)' }}>
            Skipped rows
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {result.errors.map((e, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--color-divider-soft)' }}>
                  <td style={{ ...td, width: 40, color: 'var(--tf-muted)' }}>row {e.row}</td>
                  <td style={td}>{e.title || <em style={{ color: 'var(--tf-muted)' }}>(no title)</em>}</td>
                  <td style={{ ...td, color: 'var(--status-danger)' }}>{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>Import another file</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

const th = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--tf-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 10 };
const td = { padding: '7px 10px', verticalAlign: 'top' };
