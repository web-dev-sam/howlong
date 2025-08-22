import * as vscode from 'vscode';
import { ProjectStatsProvider } from './projectStatsProvider';
import { FileAnalysisService } from '../services/fileAnalysisService';
import { FormatMode, ViewMode } from './projectStatsTreeItem';

export class ProjectStatsView implements vscode.Disposable {
    private treeView: vscode.TreeView<any>;
    private provider: ProjectStatsProvider;
    private disposables: vscode.Disposable[] = [];
    private formatMode: FormatMode = 'fun';
    private viewMode: ViewMode = 'byFolder';

    constructor(
        private context: vscode.ExtensionContext,
        private fileAnalysisService: FileAnalysisService
    ) {
        // Restore last used modes
        this.formatMode = this.context.workspaceState.get<FormatMode>('howlong.treeFormatMode', 'fun');
        this.viewMode = this.context.workspaceState.get<ViewMode>('howlong.treeViewMode', 'byFolder');
        
        this.provider = new ProjectStatsProvider(context, fileAnalysisService);
        
        // Set the restored modes on the provider
        this.provider.setFormatMode(this.formatMode);
        this.provider.setViewMode(this.viewMode);
        
        this.treeView = vscode.window.createTreeView('howlong.projectStats', {
            treeDataProvider: this.provider,
            showCollapseAll: true
        });

        this.setupCommands();
        this.setupEventHandlers();
    }

    private setupCommands(): void {
        // Refresh command
        const refreshCommand = vscode.commands.registerCommand('howlong.refreshProjectStats', () => {
            this.provider.refresh();
        });

        // Cycle format command for tree view
        const cycleFormatCommand = vscode.commands.registerCommand('howlong.cycleProjectFormat', () => {
            this.cycleFormatMode();
        });

        // Toggle view mode command
        const toggleViewCommand = vscode.commands.registerCommand('howlong.toggleProjectView', () => {
            this.toggleViewMode();
        });

        // Invalidate cache command
        const invalidateCacheCommand = vscode.commands.registerCommand('howlong.invalidateCache', () => {
            this.fileAnalysisService.invalidateCache();
            this.provider.refresh();
            vscode.window.showInformationMessage('Cache invalidated and project stats refreshed');
        });

        // Manual analyze command for testing
        const analyzeCommand = vscode.commands.registerCommand('howlong.analyzeWorkspace', async () => {
            try {
                vscode.window.showInformationMessage('Starting workspace analysis...');
                await this.fileAnalysisService.analyzeWorkspace();
                this.provider.refresh();
                vscode.window.showInformationMessage('Workspace analysis completed!');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Analysis failed: ${errorMessage}`);
            }
        });

        this.disposables.push(refreshCommand, cycleFormatCommand, toggleViewCommand, invalidateCacheCommand, analyzeCommand);
    }

    private setupEventHandlers(): void {
        // Auto-refresh when workspace folders change
        const workspaceFoldersChange = vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.provider.refresh();
        });

        this.disposables.push(workspaceFoldersChange);
    }

    private cycleFormatMode(): void {
        switch (this.formatMode) {
            case 'fun':
                this.formatMode = 'metric';
                break;
            case 'metric':
                this.formatMode = 'us';
                break;
            case 'us':
                this.formatMode = 'time';
                break;
            case 'time':
                this.formatMode = 'size';
                break;
            case 'size':
                this.formatMode = 'fun';
                break;
        }
        
        // Save the new format mode
        this.context.workspaceState.update('howlong.treeFormatMode', this.formatMode);
        
        this.provider.setFormatMode(this.formatMode);
        
        // Show user feedback
        const modeNames = {
            'fun': 'Fun comparisons',
            'metric': 'Metric units',
            'us': 'US units', 
            'time': 'Time estimates',
            'size': 'File sizes'
        };
        
        vscode.window.showInformationMessage(`Project view format: ${modeNames[this.formatMode]}`);
    }

    private toggleViewMode(): void {
        this.viewMode = this.viewMode === 'byType' ? 'byFolder' : 'byType';
        
        // Save the new view mode
        this.context.workspaceState.update('howlong.treeViewMode', this.viewMode);
        
        this.provider.setViewMode(this.viewMode);
        
        const modeNames = {
            'byType': 'Group by File Type',
            'byFolder': 'Group by Folder Structure'
        };
        
        vscode.window.showInformationMessage(`Project view: ${modeNames[this.viewMode]}`);
    }

    reveal(element?: any): void {
        if (element) {
            this.treeView.reveal(element);
        }
    }

    dispose(): void {
        this.treeView.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
