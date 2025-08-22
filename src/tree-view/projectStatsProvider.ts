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
        const projectDescription = this.formatLength(this.projectStats.totalLengthInCm, undefined, undefined, this.projectStats);
        const projectTotalItem = new ProjectStatsTreeItem(
            'project',
            'Project Total',
            this.projectStats.totalLengthInCm,
            vscode.TreeItemCollapsibleState.None,
            this.projectStats,  // Pass the project stats as data
            undefined,
            projectDescription
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
            const typeDescription = this.formatLength(typeStats.totalLengthInCm);
            const typeItem = new ProjectStatsTreeItem(
                'filetype',
                `${typeStats.extension} (${typeStats.fileCount})`,
                typeStats.totalLengthInCm,
                vscode.TreeItemCollapsibleState.Collapsed,
                typeStats,
                undefined,
                typeDescription
            );

            // Create file items for this type (top 10 files sorted alphabetically)
            const sortedFiles = typeStats.files.sort((a, b) => {
                const nameA = (a.relativePath.split('/').pop() || a.relativePath).toLowerCase();
                const nameB = (b.relativePath.split('/').pop() || b.relativePath).toLowerCase();
                return nameA.localeCompare(nameB);
            });
            
            const topFiles = sortedFiles.slice(0, 10);
            const fileItems: ProjectStatsTreeItem[] = topFiles.map(file => {
                const fileName = file.relativePath.split('/').pop() || file.relativePath;
                let description: string;
                
                if (this.formatMode === 'size') {
                    description = this.formatFileSize(file.fileSize);
                } else if (file.isTextFile) {
                    description = this.formatLength(file.lengthInCm, file);
                } else {
                    description = `${this.formatFileSize(file.fileSize)} (binary)`;
                }
                
                return new ProjectStatsTreeItem(
                    'file',
                    fileName,
                    file.lengthInCm,
                    vscode.TreeItemCollapsibleState.None,
                    file,
                    undefined,
                    description
                );
            });

            // Add "show more" item if there are more files
            if (sortedFiles.length > 10) {
                const remainingCount = sortedFiles.length - 10;
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

        const { rootFiles, folderStructure } = this.buildFolderStructure(allFiles);
        
        // Add folder items first (sorted alphabetically)
        const folderItems = this.createFolderTreeItems(folderStructure);
        this.rootItems.push(...folderItems);
        
        // Then add root files (sorted alphabetically)
        const sortedRootFiles = rootFiles.sort((a, b) => {
            const nameA = (a.relativePath.split('/').pop() || a.relativePath).toLowerCase();
            const nameB = (b.relativePath.split('/').pop() || b.relativePath).toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        for (const file of sortedRootFiles) {
            const fileName = file.relativePath.split('/').pop() || file.relativePath;
            let description: string;
            
            if (this.formatMode === 'size') {
                description = this.formatFileSize(file.fileSize);
            } else if (file.isTextFile) {
                description = this.formatLength(file.lengthInCm, file);
            } else {
                description = `${this.formatFileSize(file.fileSize)} (binary)`;
            }
            
            this.rootItems.push(new ProjectStatsTreeItem(
                'file',
                fileName,
                file.lengthInCm,
                vscode.TreeItemCollapsibleState.None,
                file,
                undefined,
                description
            ));
        }
    }

    private buildFolderStructure(files: FileStats[]): { rootFiles: FileStats[], folderStructure: FolderStats[] } {
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
                            totalSizeInBytes: 0,
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
                    folder.totalSizeInBytes += file.fileSize;
                }
            }
        }

        // Build hierarchy relationships - process deepest folders first
        const rootFolders: FolderStats[] = [];
        
        // Sort folders by depth (deepest first) to ensure children are processed before parents
        const sortedFolders = Array.from(folderMap.entries()).sort(([pathA], [pathB]) => {
            const depthA = pathA.split('/').length;
            const depthB = pathB.split('/').length;
            return depthB - depthA; // Deeper folders first
        });
        
        for (const [path, folder] of sortedFolders) {
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
                    // Propagate stats up to parent (only from direct children)
                    parent.totalFiles += folder.totalFiles;
                    parent.totalCharacters += folder.totalCharacters;
                    parent.totalLengthInCm += folder.totalLengthInCm;
                    parent.totalSizeInBytes += folder.totalSizeInBytes;
                }
            }
        }

        return {
            rootFiles,
            folderStructure: rootFolders.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        };
    }

    private createFolderTreeItems(folders: FolderStats[]): ProjectStatsTreeItem[] {
        return folders.map(folder => {
            const children: ProjectStatsTreeItem[] = [];
            
            // Add subfolders (sorted alphabetically)
            if (folder.subfolders.length > 0) {
                const sortedSubfolders = folder.subfolders.sort((a, b) => 
                    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
                );
                children.push(...this.createFolderTreeItems(sortedSubfolders));
            }
            
            // Add files (sorted alphabetically)
            const sortedFiles = folder.files.sort((a, b) => {
                const nameA = (a.relativePath.split('/').pop() || a.relativePath).toLowerCase();
                const nameB = (b.relativePath.split('/').pop() || b.relativePath).toLowerCase();
                return nameA.localeCompare(nameB);
            });
            
            // Show top 10 files
            const topFiles = sortedFiles.slice(0, 10);
                
            for (const file of topFiles) {
                const fileName = file.relativePath.split('/').pop() || file.relativePath;
                let description: string;
                
                if (this.formatMode === 'size') {
                    description = this.formatFileSize(file.fileSize);
                } else if (file.isTextFile) {
                    description = this.formatLength(file.lengthInCm, file);
                } else {
                    description = `${this.formatFileSize(file.fileSize)} (binary)`;
                }
                
                children.push(new ProjectStatsTreeItem(
                    'file',
                    fileName,
                    file.lengthInCm,
                    vscode.TreeItemCollapsibleState.None,
                    file,
                    undefined,
                    description
                ));
            }

            // Add "show more" if there are more files
            if (sortedFiles.length > 10) {
                const remainingCount = sortedFiles.length - 10;
                children.push(new ProjectStatsTreeItem(
                    'folder',
                    `... and ${remainingCount} more files`,
                    0,
                    vscode.TreeItemCollapsibleState.None
                ));
            }

            const folderDescription = this.formatLength(folder.totalLengthInCm, undefined, folder);
            const folderItem = new ProjectStatsTreeItem(
                'folder',
                folder.name,
                folder.totalLengthInCm,
                folder.subfolders.length > 0 || folder.files.length > 0 ? 
                    vscode.TreeItemCollapsibleState.Collapsed : 
                    vscode.TreeItemCollapsibleState.None,
                folder,  // Pass the folder data for resource URI
                undefined,
                folderDescription
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

    private formatLength(cm: number, fileStats?: FileStats, folderStats?: FolderStats, projectStats?: ProjectStats): string {
        if (this.formatMode === 'size') {
            if (fileStats) {
                return this.formatFileSize(fileStats.fileSize);
            } else if (folderStats) {
                return this.formatFileSize(folderStats.totalSizeInBytes);
            } else if (projectStats) {
                return this.formatFileSize(projectStats.totalSizeInBytes);
            }
            return 'N/A';
        }
        return ProjectStatsTreeItem.formatLength(cm, this.formatMode, fileStats);
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
}
