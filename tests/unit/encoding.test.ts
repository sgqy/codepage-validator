import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateEncoding } from '../../src/encoding.ts';

test('Shift JIS keeps Japanese and marks complete supplementary characters', () => {
  assert.deepEqual(validateEncoding('日本語A😀𠮷?', 'shiftjis'), {
    kind: 'checked', encoding: 'shiftjis', characters: [
      { start: 4, end: 6, character: '😀' },
      { start: 6, end: 8, character: '𠮷' },
    ],
  });
});

test('Unicode encodings preserve emoji and literal U+FEFF', () => {
  for (const encoding of ['utf8', 'utf8bom', 'utf16le', 'utf16be']) {
    assert.deepEqual(validateEncoding('\uFEFF日本😀𠮷\uFEFF', encoding), { kind: 'checked', encoding, characters: [] });
  }
});

test('offsets count CRLF and surrogate pairs in UTF-16 units', () => {
  assert.deepEqual(validateEncoding('a\r\n😀é', 'ascii'), {
    kind: 'checked', encoding: 'ascii', characters: [
      { start: 3, end: 5, character: '😀' }, { start: 5, end: 6, character: 'é' },
    ],
  });
});

test('characters with non-identical round trips are also lossy', () => {
  assert.deepEqual(validateEncoding('¥', 'shiftjis'), {
    kind: 'checked', encoding: 'shiftjis', characters: [{ start: 0, end: 1, character: '¥' }],
  });
});

test('CP932 distinguishes yen from backslash and wave dash from fullwidth tilde', () => {
  assert.deepEqual(validateEncoding('¥\\〜～', 'cp932'), {
    kind: 'checked', encoding: 'cp932', characters: [
      { start: 0, end: 1, character: '¥' }, { start: 2, end: 3, character: '〜' },
    ],
  });
});

test('repeated characters keep every occurrence and position', () => {
  assert.deepEqual(validateEncoding('😀a😀', 'ascii'), {
    kind: 'checked', encoding: 'ascii', characters: [
      { start: 0, end: 2, character: '😀' }, { start: 3, end: 5, character: '😀' },
    ],
  });
});

test('empty documents and representable question marks pass', () => {
  for (const text of ['', '?']) {
    assert.deepEqual(validateEncoding(text, 'ascii'), { kind: 'checked', encoding: 'ascii', characters: [] });
  }
});

test('unsupported encodings are explicit results', () => {
  for (const encoding of ['', 'unknown-codepage']) {
    assert.deepEqual(validateEncoding('text', encoding), { kind: 'unsupported', encoding });
  }
});
