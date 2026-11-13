import { fileURLToPath } from 'node:url';
import { runTests } from '@vscode/test-electron';

await runTests({
  version: '1.146.0',
  extensionDevelopmentPath: fileURLToPath(new URL('..', import.meta.url)),
  extensionTestsPath: fileURLToPath(new URL('./host/index.cjs', import.meta.url)),
  launchArgs: ['--disable-extensions', '--skip-welcome', '--skip-release-notes'],
});
