import { describe, it, expect } from 'vitest';
import { previewKind, fileErrorMessage } from '../fileAccess';
import { PAGE_SIZE } from '../../components/Pagination';

describe('previewKind', () => {
  it('recognises previewable types by mime type or extension', () => {
    expect(previewKind('image/png', 'a.png')).toBe('image');
    expect(previewKind(null, 'photo.JPG')).toBe('image');
    expect(previewKind('application/pdf', 'x')).toBe('pdf');
    expect(previewKind('', 'report.pdf')).toBe('pdf');
    expect(previewKind('video/mp4', 'v.mp4')).toBe('video');
    expect(previewKind('audio/mpeg', 'a.mp3')).toBe('audio');
    expect(previewKind('text/plain', 'notes.txt')).toBe('text');
    expect(previewKind('application/octet-stream', 'data.json')).toBe('text');
  });

  it('falls back to download-only for office files and very large files', () => {
    expect(previewKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx')).toBeNull();
    expect(previewKind('application/zip', 'a.zip')).toBeNull();
    expect(previewKind('text/plain', 'huge.txt', 50 * 1024 * 1024)).toBeNull();
    expect(previewKind('image/png', 'big.png', 500 * 1024 * 1024)).toBeNull();
  });
});

describe('fileErrorMessage', () => {
  it('unwraps JSON errors that arrive inside a blob', async () => {
    const err = { response: { data: new Blob([JSON.stringify({ error: 'File not found' })]) } };
    expect(await fileErrorMessage(err)).toBe('File not found');
  });
  it('uses the fallback when nothing is available', async () => {
    expect(await fileErrorMessage({}, 'nope')).toBe('nope');
  });
});

describe('pagination', () => {
  it('shows 40 records per page', () => {
    expect(PAGE_SIZE).toBe(40);
  });
});
