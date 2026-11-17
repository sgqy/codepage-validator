import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const source = await readFile(new URL('../media/icon.svg', import.meta.url));
const png = new Resvg(source).render().asPng();
await writeFile(new URL('../media/icon.png', import.meta.url), png);
