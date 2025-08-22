import * as vscode from 'vscode';
import { FileStats, FileTypeStats, FolderStats } from '../models/fileStats';
import { formatLengthFun, formatLengthMetric, formatLengthUS, formatLengthTime } from '../utils/utils';

export type TreeItemType = 'project' | 'filetype' | 'file' | 'folder';
export type FormatMode = 'fun' | 'metric' | 'us' | 'time';
export type ViewMode = 'byType' | 'byFolder';

export class ProjectStatsTreeItem extends vscode.TreeItem {
    constructor(
        public readonly type: TreeItemType,
        label: string,
        public readonly lengthInCm: number,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly data?: FileStats | FileTypeStats | FolderStats,
        public readonly children?: ProjectStatsTreeItem[]
    ) {
        super(label, collapsibleState);
        
        this.tooltip = this.generateTooltip();
        this.contextValue = type;
        this.iconPath = this.getIconPath();
        
        if (type === 'file') {
            // Set the resource URI to get proper file icons and enable "Open File" command
            const fileStats = data as FileStats;
            this.resourceUri = vscode.Uri.file(fileStats.path);
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [this.resourceUri]
            };
        } else if (type === 'folder') {
            // Set the resource URI for folders to get proper folder icons
            const folderStats = data as FolderStats;
            if (folderStats && folderStats.path) {
                this.resourceUri = vscode.Uri.file(folderStats.path);
            }
        }
    }

    private getIconPath(): vscode.ThemeIcon | undefined {
        switch (this.type) {
            case 'project':
                return new vscode.ThemeIcon('folder-opened');
            case 'filetype':
                return new vscode.ThemeIcon('symbol-file');
            case 'folder':
                return vscode.ThemeIcon.Folder;
            case 'file':
                return vscode.ThemeIcon.File;
            default:
                return undefined;
        }
    }

    private generateTooltip(): string {
        switch (this.type) {
            case 'project':
                return `Total project length: ${this.formatLength(this.lengthInCm, 'metric')}`;
            case 'filetype':
                const typeStats = this.data as FileTypeStats;
                return `${typeStats.extension} files: ${typeStats.fileCount} files, total length: ${this.formatLength(this.lengthInCm, 'metric')}`;
            case 'folder':
                const folderStats = this.data as FolderStats;
                return `Folder: ${folderStats?.name || 'Unknown'}\n${folderStats?.totalFiles || 0} files\nTotal length: ${this.formatLength(this.lengthInCm, 'metric')}`;
            case 'file':
                const fileStats = this.data as FileStats;
                return `${fileStats.relativePath}\nCharacters: ${fileStats.characterCount}\nLength: ${this.formatLength(this.lengthInCm, 'metric')}`;
            default:
                return typeof this.label === 'string' ? this.label : '';
        }
    }

    createUpdatedItem(formatMode: FormatMode): ProjectStatsTreeItem {
        let newLabel: string;
        
        switch (this.type) {
            case 'project':
                newLabel = `Project Total: ${this.formatLength(this.lengthInCm, formatMode)}`;
                break;
            case 'filetype':
                const typeStats = this.data as FileTypeStats;
                newLabel = `${typeStats.extension} (${typeStats.fileCount}) - ${this.formatLength(this.lengthInCm, formatMode)}`;
                break;
            case 'folder':
                const folderName = typeof this.label === 'string' ? 
                    this.label.split(' - ')[0] : // Extract folder name before the " - length" part
                    'Folder';
                newLabel = `${folderName} - ${this.formatLength(this.lengthInCm, formatMode)}`;
                break;
            case 'file':
                const fileStats = this.data as FileStats;
                const fileName = fileStats.relativePath.split('/').pop() || fileStats.relativePath;
                newLabel = `${fileName} - ${this.formatLength(this.lengthInCm, formatMode)}`;
                break;
            default:
                newLabel = typeof this.label === 'string' ? this.label : '';
        }

        return new ProjectStatsTreeItem(
            this.type,
            newLabel,
            this.lengthInCm,
            this.collapsibleState,
            this.data,
            this.children
        );
    }

    private formatLength(cm: number, mode: FormatMode): string {
        switch (mode) {
            case 'fun':
                return formatLengthFun(cm);
            case 'metric':
                return formatLengthMetric(cm);
            case 'us':
                return formatLengthUS(cm * 0.393701); // Convert cm to inches
            case 'time':
                return formatLengthTime(cm);
            default:
                return formatLengthMetric(cm);
        }
    }

    static formatLength(cm: number, mode: FormatMode): string {
        switch (mode) {
            case 'fun':
                return formatLengthFun(cm);
            case 'metric':
                return formatLengthMetric(cm);
            case 'us':
                return formatLengthUS(cm * 0.393701); // Convert cm to inches
            case 'time':
                return formatLengthTime(cm);
            default:
                return formatLengthMetric(cm);
        }
    }
}
