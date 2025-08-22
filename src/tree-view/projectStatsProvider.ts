import * as vscode from 'vscode';
import { ProjectStatsTreeItem, FormatMode, ViewMode } from './projectStatsTreeItem';
import { FileAnalysisService } from '../services/fileAnalysisService';
import { ProjectStats, FolderStats, FileStats } from '../models/fileStats';

export class ProjectStatsProvider implements vscode.TreeDataProvider<ProjectStatsTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectStatsTreeItem | undefined | null | void> = new vscode.EventEmitter<ProjectStatsTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectStatsTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private projectStats: ProjectStats | null = null;
    private rootItems: ProjectStatsTreeItem[] = [];
    private formatMode: FormatMode = 'fun';
    private viewMode: ViewMode = 'byFolder';
    private isLoading = false;

    constructor(
        private context: vscode.ExtensionContext,
        private fileAnalysisService: FileAnalysisService
    ) {}

    refresh(): void {
        this.projectStats = null;
        this.rootItems = [];
        this._onDidChangeTreeData.fire();
    }

    setFormatMode(mode: FormatMode): void {
        this.formatMode = mode;
        this.updateTreeItems();
        this._onDidChangeTreeData.fire();
    }

    setViewMode(mode: ViewMode): void {
        this.viewMode = mode;
        this.rootItems = []; // Clear cache to rebuild
        this._onDidChangeTreeData.fire();
    }

    getViewMode(): ViewMode {
        return this.viewMode;
    }

    getTreeItem(element: ProjectStatsTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ProjectStatsTreeItem): Promise<ProjectStatsTreeItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        if (!element) {
            // Root level - return project summary and file type categories
            return this.getRootItems();
        }

        // Return children of a specific element
        if (element.children) {
            return element.children;
        }

        return [];
    }

    private async getRootItems(): Promise<ProjectStatsTreeItem[]> {
        if (this.rootItems.length > 0) {
            return this.rootItems;
        }

        if (this.isLoading) {
            return [new ProjectStatsTreeItem(
                'project',
                'Analyzing project...',
                0,
                vscode.TreeItemCollapsibleState.None
            )];
        }

        try {
            this.isLoading = true;
            this.projectStats = await this.fileAnalysisService.analyzeWorkspace();
            this.buildTreeItems();
            return this.rootItems;
        } catch (error) {
            console.error('Failed to analyze workspace:', error);
            
            // Show more specific error information
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`HowLong: Failed to analyze project - ${errorMessage}`);
            
            return [new ProjectStatsTreeItem(
                'project',
                `Error: ${errorMessage}`,
                0,
                vscode.TreeItemCollapsibleState.None
            )];
        } finally {
            this.isLoading = false;
        }
    }

    private buildTreeItems(): void {
        if (!this.projectStats) {
            return;
        }

        this.rootItems = [];

        // Project total summary
        const projectTotalItem = new ProjectStatsTreeItem(
            'project',
            `Project Total: ${this.formatLength(this.projectStats.totalLengthInCm)}`,
            this.projectStats.totalLengthInCm,
            vscode.TreeItemCollapsibleState.None
        );
        this.rootItems.push(projectTotalItem);

        if (this.viewMode === 'byType') {
            this.buildFileTypeView();
        } else {
            this.buildFolderView();
        }
    }

    private buildFileTypeView(): void {
        if (!this.projectStats) {
            return;
        }

        // File type breakdown
        const fileTypeStats = this.fileAnalysisService.getFileTypeStats(this.projectStats);
        
        for (const typeStats of fileTypeStats) {
            // Create file type category item
            const typeItem = new ProjectStatsTreeItem(
                'filetype',
                `${typeStats.extension} (${typeStats.fileCount}) - ${this.formatLength(typeStats.totalLengthInCm)}`,
                typeStats.totalLengthInCm,
                vscode.TreeItemCollapsibleState.Collapsed,
                typeStats
            );

            // Create file items for this type (top 10 longest files)
            const topFiles = typeStats.files.slice(0, 10);
            const fileItems: ProjectStatsTreeItem[] = topFiles.map(file => {
                const fileName = file.relativePath.split('/').pop() || file.relativePath;
                return new ProjectStatsTreeItem(
                    'file',
                    `${fileName} - ${this.formatLength(file.lengthInCm)}`,
                    file.lengthInCm,
                    vscode.TreeItemCollapsibleState.None,
                    file
                );
            });

            // Add "show more" item if there are more files
            if (typeStats.files.length > 10) {
                const remainingCount = typeStats.files.length - 10;
                const showMoreItem = new ProjectStatsTreeItem(
                    'filetype',
                    `... and ${remainingCount} more files`,
                    0,
                    vscode.TreeItemCollapsibleState.None
                );
                fileItems.push(showMoreItem);
            }

            // Set children for the type item
            (typeItem as any).children = fileItems;
            this.rootItems.push(typeItem);
        }
    }

    private buildFolderView(): void {
        if (!this.projectStats) {
            return;
        }

        // Get all files and build folder structure
        const allFiles: FileStats[] = [];
        for (const [, files] of this.projectStats.filesByExtension) {
            allFiles.push(...files);
        }

        const folderStructure = this.buildFolderStructure(allFiles);
        const folderItems = this.createFolderTreeItems(folderStructure);
        this.rootItems.push(...folderItems);
    }

    private buildFolderStructure(files: FileStats[]): FolderStats[] {
        const folderMap = new Map<string, FolderStats>();
        const rootFiles: FileStats[] = [];
        
        // Separate root files from files in subdirectories
        for (const file of files) {
            const pathParts = file.relativePath.split('/');
            
            if (pathParts.length === 1) {
                // Root-level file
                rootFiles.push(file);
            } else {
                // File in subdirectory - build folder hierarchy
                for (let i = 0; i < pathParts.length - 1; i++) {
                    const currentPath = pathParts.slice(0, i + 1).join('/');
                    const folderName = pathParts[i];
                    
                    if (!folderMap.has(currentPath)) {
                        folderMap.set(currentPath, {
                            path: currentPath,
                            name: folderName,
                            totalFiles: 0,
                            totalCharacters: 0,
                            totalLengthInCm: 0,
                            files: [],
                            subfolders: []
                        });
                    }
                }
                
                // Add file to its direct parent folder
                const parentPath = pathParts.slice(0, -1).join('/');
                if (parentPath && folderMap.has(parentPath)) {
                    const folder = folderMap.get(parentPath)!;
                    folder.files.push(file);
                    folder.totalFiles++;
                    folder.totalCharacters += file.characterCount;
                    folder.totalLengthInCm += file.lengthInCm;
                }
            }
        }

        // Build hierarchy relationships
        const rootFolders: FolderStats[] = [];
        for (const [path, folder] of folderMap) {
            const pathParts = path.split('/');
            if (pathParts.length === 1) {
                // Root level folder
                rootFolders.push(folder);
            } else {
                // Child folder
                const parentPath = pathParts.slice(0, -1).join('/');
                const parent = folderMap.get(parentPath);
                if (parent) {
                    parent.subfolders.push(folder);
                    // Propagate stats up to parent
                    parent.totalFiles += folder.totalFiles;
                    parent.totalCharacters += folder.totalCharacters;
                    parent.totalLengthInCm += folder.totalLengthInCm;
                }
            }
        }

        // Create a special "Root Files" folder if there are any root-level files
        if (rootFiles.length > 0) {
            const rootFilesFolder: FolderStats = {
                path: '',
                name: 'Root Files',
                totalFiles: rootFiles.length,
                totalCharacters: rootFiles.reduce((sum, f) => sum + f.characterCount, 0),
                totalLengthInCm: rootFiles.reduce((sum, f) => sum + f.lengthInCm, 0),
                files: rootFiles,
                subfolders: []
            };
            rootFolders.unshift(rootFilesFolder); // Add at the beginning
        }

        return rootFolders.sort((a, b) => {
            // Keep "Root Files" at the top, then sort by length
            if (a.name === 'Root Files') {
                return -1;
            }
            if (b.name === 'Root Files') {
                return 1;
            }
            return b.totalLengthInCm - a.totalLengthInCm;
        });
    }

    private createFolderTreeItems(folders: FolderStats[]): ProjectStatsTreeItem[] {
        return folders.map(folder => {
            const children: ProjectStatsTreeItem[] = [];
            
            // Add subfolders
            if (folder.subfolders.length > 0) {
                children.push(...this.createFolderTreeItems(folder.subfolders));
            }
            
            // Add files (top 10 by length)
            const topFiles = folder.files
                .sort((a, b) => b.lengthInCm - a.lengthInCm)
                .slice(0, 10);
                
            for (const file of topFiles) {
                const fileName = file.relativePath.split('/').pop() || file.relativePath;
                children.push(new ProjectStatsTreeItem(
                    'file',
                    `${fileName} - ${this.formatLength(file.lengthInCm)}`,
                    file.lengthInCm,
                    vscode.TreeItemCollapsibleState.None,
                    file
                ));
            }

            // Add "show more" if there are more files
            if (folder.files.length > 10) {
                const remainingCount = folder.files.length - 10;
                children.push(new ProjectStatsTreeItem(
                    'folder',
                    `... and ${remainingCount} more files`,
                    0,
                    vscode.TreeItemCollapsibleState.None
                ));
            }

            const folderItem = new ProjectStatsTreeItem(
                'folder',
                `${folder.name} - ${this.formatLength(folder.totalLengthInCm)}`,
                folder.totalLengthInCm,
                folder.subfolders.length > 0 || folder.files.length > 0 ? 
                    vscode.TreeItemCollapsibleState.Collapsed : 
                    vscode.TreeItemCollapsibleState.None,
                folder  // Pass the folder data for resource URI
            );

            (folderItem as any).children = children;
            return folderItem;
        });
    }

    private updateTreeItems(): void {
        this.rootItems = this.rootItems.map(item => 
            this.updateTreeItemRecursive(item)
        );
    }

    private updateTreeItemRecursive(item: ProjectStatsTreeItem): ProjectStatsTreeItem {
        const updatedItem = item.createUpdatedItem(this.formatMode);
        
        if (updatedItem.children) {
            (updatedItem as any).children = updatedItem.children.map(child => 
                this.updateTreeItemRecursive(child)
            );
        }
        
        return updatedItem;
    }

    private formatLength(cm: number): string {
        return ProjectStatsTreeItem.formatLength(cm, this.formatMode);
    }
}
