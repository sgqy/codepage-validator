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
  try {
    const unicode = await vscode.workspace.openTextDocument({ content: '日本語¥😀', language: 'typescript', encoding: 'utf8' });
    await vscode.window.showTextDocument(unicode);
    const document = await vscode.workspace.openTextDocument({ content: '日本語¥😀', encoding: 'shiftjis' });
    const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
    await eventually(() => issues(document).length === 2);
    assert.equal(issues(unicode).length, 0);
    assert.deepEqual(issues(document).map(issue => [issue.range.start.character, issue.range.end.character]), [[3, 4], [4, 6]]);
    for (const issue of issues(document)) {
      assert.equal(issue.severity, vscode.DiagnosticSeverity.Warning);
      assert.match(issue.message, /shiftjis/);
    }

    await editor.edit(edit => edit.replace(new vscode.Range(0, 3, 0, 6), '語'));
    await eventually(() => issues(document).length === 0);
    await editor.edit(edit => edit.insert(new vscode.Position(0, 4), '😀'));
    await eventually(() => issues(document).length === 1);

    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    await eventually(() => issues(document).length === 0);
    assert.equal(issues(unicode).length, 0);
    console.log('Passed: current document encoding, CP932 yen mapping, warning severity, UTF-16 ranges, live edits, split editors, close cleanup.');
  } finally {
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  }
};
