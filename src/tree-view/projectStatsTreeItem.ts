import * as vscode from 'vscode';
import { FileStats, FileTypeStats, FolderStats, ProjectStats } from '../models/fileStats';
import { formatLengthFun, formatLengthMetric, formatLengthUS, formatLengthTime } from '../utils/utils';

export type TreeItemType = 'project' | 'filetype' | 'file' | 'folder';
export type FormatMode = 'fun' | 'metric' | 'us' | 'time' | 'size';
export type ViewMode = 'byType' | 'byFolder';

export class ProjectStatsTreeItem extends vscode.TreeItem {
    constructor(
        public readonly type: TreeItemType,
        label: string,
        public readonly lengthInCm: number,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly data?: FileStats | FileTypeStats | FolderStats | ProjectStats,
        public readonly children?: ProjectStatsTreeItem[],
        description?: string
    ) {
        super(label, collapsibleState);
        
        this.tooltip = this.generateTooltip();
        this.contextValue = type;
        this.iconPath = this.getIconPath();
        this.description = description; // Set the description for right-aligned text
        
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
                const projectStats = this.data as ProjectStats;
                return `Total project length: ${this.formatLength(this.lengthInCm, 'metric')}\nTotal project size: ${projectStats ? this.formatFileSize(projectStats.totalSizeInBytes) : 'Unknown'}`;
            case 'filetype':
                const typeStats = this.data as FileTypeStats;
                return `${typeStats.extension} files: ${typeStats.fileCount} files, total length: ${this.formatLength(this.lengthInCm, 'metric')}`;
            case 'folder':
                const folderStats = this.data as FolderStats;
                return `Folder: ${folderStats?.name || 'Unknown'}\n${folderStats?.totalFiles || 0} files\nTotal length: ${this.formatLength(this.lengthInCm, 'metric')}\nTotal size: ${folderStats ? this.formatFileSize(folderStats.totalSizeInBytes) : 'Unknown'}`;
            case 'file':
                const fileStats = this.data as FileStats;
                if (fileStats.isTextFile) {
                    return `${fileStats.relativePath}\nCharacters: ${fileStats.characterCount}\nLength: ${this.formatLength(this.lengthInCm, 'metric')}`;
                } else {
                    return `${fileStats.relativePath}\nBinary file\nSize: ${this.formatFileSize(fileStats.fileSize)}`;
                }
            default:
                return typeof this.label === 'string' ? this.label : '';
        }
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) {
            return '0 B';
        }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    createUpdatedItem(formatMode: FormatMode): ProjectStatsTreeItem {
        let newLabel: string;
        let newDescription: string | undefined;
        
        switch (this.type) {
            case 'project':
                newLabel = 'Project Total';
                if (formatMode === 'size') {
                    const projectStats = this.data as ProjectStats;
                    if (projectStats && typeof projectStats.totalSizeInBytes === 'number') {
                        newDescription = this.formatFileSize(projectStats.totalSizeInBytes);
                    } else {
                        newDescription = 'N/A';
                    }
                } else {
                    newDescription = this.formatLength(this.lengthInCm, formatMode);
                }
                break;
            case 'filetype':
                const typeStats = this.data as FileTypeStats;
                newLabel = `${typeStats.extension} (${typeStats.fileCount})`;
                newDescription = this.formatLength(this.lengthInCm, formatMode);
                break;
            case 'folder':
                const folderName = typeof this.label === 'string' ? 
                    this.label.split(' - ')[0] : // Extract folder name before the " - " part
                    'Folder';
                newLabel = folderName;
                if (formatMode === 'size') {
                    const folderStats = this.data as FolderStats;
                    if (folderStats && typeof folderStats.totalSizeInBytes === 'number') {
                        newDescription = this.formatFileSize(folderStats.totalSizeInBytes);
                    } else {
                        newDescription = 'N/A';
                    }
                } else {
                    newDescription = this.formatLength(this.lengthInCm, formatMode);
                }
                break;
            case 'file':
                const fileStats = this.data as FileStats;
                const fileName = fileStats.relativePath.split('/').pop() || fileStats.relativePath;
                newLabel = fileName;
                if (formatMode === 'size') {
                    newDescription = this.formatFileSize(fileStats.fileSize);
                } else if (fileStats.isTextFile) {
                    newDescription = this.formatLength(this.lengthInCm, formatMode);
                } else {
                    newDescription = `${this.formatFileSize(fileStats.fileSize)} (binary)`;
                }
                break;
            default:
                newLabel = typeof this.label === 'string' ? this.label : '';
                newDescription = undefined;
        }

        return new ProjectStatsTreeItem(
            this.type,
            newLabel,
            this.lengthInCm,
            this.collapsibleState,
            this.data,
            this.children,
            newDescription
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
            case 'size':
                // For size mode, check the type of data we have
                if (this.data && 'totalSizeInBytes' in this.data) {
                    if ('path' in this.data) {
                        // FolderStats
                        const folderStats = this.data as FolderStats;
                        return this.formatFileSize(folderStats.totalSizeInBytes);
                    } else {
                        // ProjectStats
                        const projectStats = this.data as ProjectStats;
                        return this.formatFileSize(projectStats.totalSizeInBytes);
                    }
                }
                // For file stats
                if (this.data && 'fileSize' in this.data) {
                    const fileStats = this.data as FileStats;
                    return this.formatFileSize(fileStats.fileSize);
                }

                return 'N/A';
            default:
                return formatLengthMetric(cm);
        }
    }

    static formatLength(cm: number, mode: FormatMode, fileStats?: FileStats): string {
        switch (mode) {
            case 'fun':
                return formatLengthFun(cm);
            case 'metric':
                return formatLengthMetric(cm);
            case 'us':
                return formatLengthUS(cm * 0.393701); // Convert cm to inches
            case 'time':
                return formatLengthTime(cm);
            case 'size':
                if (fileStats) {
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB'];
                    const bytes = fileStats.fileSize;
                    if (bytes === 0) {
                        return '0 B';
                    }
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                }
                return 'N/A';
            default:
                return formatLengthMetric(cm);
        }
    }
}
