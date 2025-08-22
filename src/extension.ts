import * as vscode from 'vscode';
import { FileInfoStatusBar } from './status-bar/fileInfoStatusBar';
import { ProjectStatsView } from './tree-view/projectStatsView';
import { FileAnalysisService } from './services/fileAnalysisService';

let fileInfoStatusBar: FileInfoStatusBar;
let projectStatsView: ProjectStatsView;
let fileAnalysisService: FileAnalysisService;

export function activate(context: vscode.ExtensionContext) {
	console.log('howlong activated!');

	// Only initialize if we have a workspace
	if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
		// Function to get calibrated cm per character
		const getCmPerCharacter = (): number => {
			const workspaceValue = context.workspaceState.get<number>('fileLength.cmPerCharacter');
			if (workspaceValue !== undefined) {
				return workspaceValue;
			}
			return vscode.workspace.getConfiguration().get('fileLength.cmPerCharacter', 17.78 / 58);
		};

		// Initialize services
		fileAnalysisService = new FileAnalysisService(context, getCmPerCharacter);

		// Initialize UI components
		fileInfoStatusBar = new FileInfoStatusBar(context);
		projectStatsView = new ProjectStatsView(context, fileAnalysisService);

		// Register for disposal
		context.subscriptions.push(fileInfoStatusBar, projectStatsView, fileAnalysisService);
	} else {
		console.log('No workspace folders found, HowLong features disabled');
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
  fileInfoStatusBar?.dispose();

  console.log('howlong deactivated!');
}
