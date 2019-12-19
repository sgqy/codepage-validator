import * as vscode from 'vscode';
import * as iconv from 'iconv-lite';

export function deactivate() { }
export function activate(context: vscode.ExtensionContext) {
	// manually trigger the function
	const disposable = vscode.commands.registerTextEditorCommand(`extension.validateCodepage`, processText);
	context.subscriptions.push(disposable);

	// auto trigger
	const is_realtime = vscode.workspace.getConfiguration().get(`codepageValidator.RealTime`);
	if(is_realtime) {
		vscode.window.onDidChangeActiveTextEditor(processText); // switch tab
		vscode.workspace.onDidChangeTextDocument(e => {	processText(vscode.window.activeTextEditor); }); // modify text
	}

}

const bar = vscode.window.createStatusBarItem();

let deco: vscode.TextEditorDecorationType;

function processText(textEditor: vscode.TextEditor | undefined) {
	if(!textEditor) {
		return;
	}
	// init decoration style
	const fc: string = vscode.workspace.getConfiguration().get(`codepageValidator.Style.Foreground`) || `#0f0f`; // green
	const bc: string = vscode.workspace.getConfiguration().get(`codepageValidator.Style.Background`) || `#cccf`; // grey

	// clean decoration
	if (deco) {
		deco.dispose();
	}
	deco = vscode.window.createTextEditorDecorationType({ color: fc, backgroundColor: bc });

	// generate list
	const cp: string = vscode.workspace.getConfiguration().get(`codepageValidator.Charset`) || `utf8`;
	// status bar
	bar.text = `Checking Codepage: ` + cp;
	bar.show();
	// check characters one by one
	let cp_list: vscode.Range[] = [];
	
	for (let i = 0; i < textEditor.document.lineCount; ++i) {
		const line = textEditor.document.lineAt(i).text;
		for (let j = 0; j < line.length; ++j) {
			const uchar = line.charAt(j);
			const loss = cpfilt(uchar, cp);
			if (loss !== uchar) { // if the charset not compatible, they should be non-equal
				cp_list.push(new vscode.Range(i, j, i, j + 1));
			}
		}
	}

	// apply list
	textEditor.setDecorations(deco, cp_list);
}

// filter the string by specified codepage
function cpfilt(str: string, filter: string): string {
	const bin = iconv.encode(str, filter);
	const ret = iconv.decode(bin, filter);
	return ret;
}