const assert = require('node:assert/strict');
const vscode = require('vscode');

const issues = document => vscode.languages.getDiagnostics(document.uri).filter(issue => issue.source === 'Codepage Validator');

async function eventually(check) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.ok(check(), 'Expected diagnostics were not published within 5 seconds');
}

exports.run = async () => {
  const extension = vscode.extensions.getExtension('sgqy.codepage-validator');
  assert.ok(extension);
  await extension.activate();
  const config = vscode.workspace.getConfiguration('codepageValidator');
  try {
    const document = await vscode.workspace.openTextDocument({ content: '日本語😀', language: 'typescript', encoding: 'utf8' });
    const editor = await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand('codepageValidator.validate');
    assert.equal(issues(document).length, 0);

    await config.update('encoding', 'shiftjis', vscode.ConfigurationTarget.Global);
    await eventually(() => issues(document).length === 1);
    assert.equal(issues(document)[0].range.start.character, 3);
    assert.equal(issues(document)[0].range.end.character, 5);

    await editor.edit(edit => edit.replace(new vscode.Range(0, 3, 0, 5), '語'));
    await eventually(() => issues(document).length === 0);
    await editor.edit(edit => edit.insert(new vscode.Position(0, 4), '😀'));
    await eventually(() => issues(document).length === 1);

    await config.update('liveValidation', false, vscode.ConfigurationTarget.Global);
    await eventually(() => issues(document).length === 0);
    await vscode.commands.executeCommand('codepageValidator.validate');
    assert.equal(issues(document).length, 1);
    await editor.edit(edit => edit.insert(new vscode.Position(0, 0), 'a'));
    await eventually(() => issues(document).length === 0);
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(issues(document).length, 0);

    await config.update('encoding', 'invalid-codepage', vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('codepageValidator.validate');
    assert.match(issues(document)[0].message, /Unsupported encoding/);

    await config.update('encoding', 'auto', vscode.ConfigurationTarget.Global);
    await config.update('liveValidation', true, vscode.ConfigurationTarget.Global);
    await eventually(() => issues(document).length === 0);

    const legacy = await vscode.workspace.openTextDocument({ content: '日本語😀', encoding: 'shiftjis' });
    await vscode.window.showTextDocument(legacy, vscode.ViewColumn.Beside);
    await eventually(() => issues(legacy).length === 1);
    assert.equal(issues(document).length, 0);
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    await eventually(() => issues(legacy).length === 0);
    console.log('Passed: automatic diagnostics, UTF-16 ranges, edits, live/manual modes, invalid encoding, document encoding, split editors, close cleanup.');
  } finally {
    for (const key of ['encoding', 'liveValidation']) {
      await config.update(key, undefined, vscode.ConfigurationTarget.Global);
    }
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  }
};
