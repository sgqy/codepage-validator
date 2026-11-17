import * as vscode from 'vscode';
import { validateEncoding } from './encoding.ts';

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('codepage-validator');
  const highlight = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('editorError.foreground'),
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });
  const pending = new Map<vscode.TextDocument, ReturnType<typeof setTimeout>>();

  function clear(document: vscode.TextDocument): void {
    diagnostics.delete(document.uri);
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document === document) { editor.setDecorations(highlight, []); }
    }
  }

  function validate(document: vscode.TextDocument): void {
    const encoding = document.encoding;
    const result = validateEncoding(document.getText(), encoding);
    const issues: vscode.Diagnostic[] = [];
    const ranges: vscode.Range[] = [];

    if (result.kind === 'unsupported') {
      issues.push(new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0),
        `Cannot validate the document encoding "${encoding}".`,
        vscode.DiagnosticSeverity.Warning));
    } else {
      for (const character of result.characters) {
        const range = new vscode.Range(document.positionAt(character.start), document.positionAt(character.end));
        ranges.push(range);
        issues.push(new vscode.Diagnostic(range,
          `${JSON.stringify(character.character)} cannot be saved unchanged in ${encoding}.`,
          vscode.DiagnosticSeverity.Warning));
      }
    }
    for (const issue of issues) { issue.source = 'Codepage Validator'; }
    diagnostics.set(document.uri, issues);
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document === document) { editor.setDecorations(highlight, ranges); }
    }
  }

  function cancel(document: vscode.TextDocument): void {
    clearTimeout(pending.get(document));
    pending.delete(document);
  }

  function refresh(): void {
    const visible = new Set(vscode.window.visibleTextEditors.map(editor => editor.document));
    for (const document of visible) {
      cancel(document);
      validate(document);
    }
  }

  context.subscriptions.push(
    diagnostics, highlight,
    { dispose: () => { for (const document of pending.keys()) { cancel(document); } } },
    vscode.window.onDidChangeVisibleTextEditors(refresh),
    vscode.workspace.onDidCloseTextDocument(document => { cancel(document); clear(document); }),
    vscode.workspace.onDidChangeTextDocument(({ document }) => {
      cancel(document);
      clear(document);
      if (vscode.window.visibleTextEditors.some(editor => editor.document === document)) {
        // This event also covers a saving-encoding change with no text edits.
        pending.set(document, setTimeout(() => { pending.delete(document); validate(document); }, 150));
      }
    }),
  );
  refresh();
}
