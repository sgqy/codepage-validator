import iconv from 'iconv-lite';

export interface LossyCharacter {
  readonly start: number;
  readonly end: number;
  readonly character: string;
}

export type ValidationResult =
  | { readonly kind: 'unsupported'; readonly encoding: string }
  | { readonly kind: 'checked'; readonly encoding: string; readonly characters: readonly LossyCharacter[] };

/** Compare each Unicode code point with its encoded-and-decoded value. */
export function validateEncoding(text: string, encoding: string): ValidationResult {
  const codec = encoding.toLowerCase() === 'utf8bom' ? 'utf8' : encoding;
  if (!iconv.encodingExists(codec)) {
    return { kind: 'unsupported', encoding };
  }

  const characters: LossyCharacter[] = [];
  const cache = new Map<string, boolean>();
  let offset = 0;
  for (const character of text) {
    let lossy = cache.get(character);
    if (lossy === undefined) {
      // U+FEFF within the text is content, not a decoder byte-order mark.
      lossy = iconv.decode(iconv.encode(character, codec), codec, { stripBOM: false }) !== character;
      cache.set(character, lossy);
    }
    if (lossy) {
      characters.push({ start: offset, end: offset + character.length, character });
    }
    // VS Code positions count UTF-16 units, including both halves of a surrogate pair.
    offset += character.length;
  }
  return { kind: 'checked', encoding, characters };
}
