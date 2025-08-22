import * as vscode from 'vscode';
import { FileInfoStatusBar } from './status-bar/fileInfoStatusBar';

let fileInfoStatusBar: FileInfoStatusBar;

export function activate(context: vscode.ExtensionContext) {
	console.log('howlong activated!');

  fileInfoStatusBar = new FileInfoStatusBar(context);
  context.subscriptions.push(fileInfoStatusBar);
}

// This method is called when your extension is deactivated
export function deactivate() {
  fileInfoStatusBar?.dispose();

  console.log('howlong deactivated!');
}
