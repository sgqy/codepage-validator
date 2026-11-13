import * as vscode from 'vscode';
import { validateEncoding } from './encoding.ts';

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('codepage-validator');
  const highlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('inputValidation.warningBackground'),
    border: '1px solid',
    borderColor: new vscode.ThemeColor('editorWarning.foreground'),
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.name = 'Codepage Validator';
  status.command = 'codepageValidator.validate';
  const pending = new Map<vscode.TextDocument, ReturnType<typeof setTimeout>>();

  function clear(document: vscode.TextDocument): void {
    diagnostics.delete(document.uri);
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document === document) { editor.setDecorations(highlight, []); }
    }
    if (vscode.window.activeTextEditor?.document === document) { status.hide(); }
  }

  function validate(document: vscode.TextDocument): void {
    const configured = vscode.workspace.getConfiguration('codepageValidator', document).get('encoding', 'auto').trim();
    const encoding = configured === 'auto' ? document.encoding : configured;
    const result = validateEncoding(document.getText(), encoding);
    const issues: vscode.Diagnostic[] = [];
    const ranges: vscode.Range[] = [];

    if (result.kind === 'unsupported') {
      issues.push(new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0),
        `Unsupported encoding "${encoding}". Set codepageValidator.encoding to a supported encoding or auto.`,
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
    if (vscode.window.activeTextEditor?.document === document) {
      status.text = result.kind === 'unsupported'
        ? '$(warning) Unsupported encoding'
        : `$(checklist) ${encoding}: ${ranges.length}`;
      status.tooltip = 'Codepage Validator: click to validate the current file.';
      status.show();
    }
  }

  function cancel(document: vscode.TextDocument): void {
    clearTimeout(pending.get(document));
    pending.delete(document);
  }

  function live(document: vscode.TextDocument): boolean {
    return vscode.workspace.getConfiguration('codepageValidator', document).get('liveValidation', true);
  }

  function refresh(): void {
    status.hide();
    const visible = new Set(vscode.window.visibleTextEditors.map(editor => editor.document));
    for (const document of visible) {
      cancel(document);
      if (live(document)) { validate(document); } else { clear(document); }
    }
  }

  context.subscriptions.push(
    diagnostics, highlight, status,
    { dispose: () => { for (const document of pending.keys()) { cancel(document); } } },
    vscode.commands.registerCommand('codepageValidator.validate', () => {
      const document = vscode.window.activeTextEditor?.document;
      if (document) { cancel(document); validate(document); }
    }),
    vscode.window.onDidChangeActiveTextEditor(refresh),
    vscode.window.onDidChangeVisibleTextEditors(refresh),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('codepageValidator')) {
        diagnostics.clear();
        for (const document of pending.keys()) { cancel(document); }
        refresh();
      }
    }),
    vscode.workspace.onDidCloseTextDocument(document => { cancel(document); clear(document); }),
    vscode.workspace.onDidChangeTextDocument(({ document }) => {
      cancel(document);
      clear(document);
      if (live(document) && vscode.window.visibleTextEditors.some(editor => editor.document === document)) {
        // This event also covers a saving-encoding change with no text edits.
        pending.set(document, setTimeout(() => { pending.delete(document); validate(document); }, 150));
      }
    }),
  );
  refresh();
}
