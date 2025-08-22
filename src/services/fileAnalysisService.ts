import * as vscode from 'vscode';
import { FileStats, ProjectStats, FileTypeStats } from '../models/fileStats';
import { GitIgnoreService } from './gitIgnoreService';
import { CacheService } from './cacheService';

export class FileAnalysisService {
    private gitIgnoreService: GitIgnoreService;
    private cacheService: CacheService;
    private isAnalyzing = false;

    constructor(
        private context: vscode.ExtensionContext,
        private getCmPerCharacter: () => number
    ) {
        this.cacheService = new CacheService(context);
        
        // Initialize GitIgnoreService when workspace is available
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        
        try {
            this.gitIgnoreService = new GitIgnoreService(workspaceFolder.uri.fsPath);
        } catch (error) {
            console.error('Failed to initialize GitIgnoreService:', error);
            throw new Error(`Failed to initialize GitIgnoreService: ${error instanceof Error ? error.message : String(error)}`);
        }

        this.setupFileWatchers();
    }

    private setupFileWatchers(): void {
        // Watch for file changes to invalidate cache
        const fileWatcher = vscode.workspace.onDidChangeTextDocument((event) => {
            this.cacheService.invalidateFileCache(event.document.uri.fsPath);
        });

        const fileCreateWatcher = vscode.workspace.onDidCreateFiles(() => {
            this.cacheService.invalidateCache();
        });

        const fileDeleteWatcher = vscode.workspace.onDidDeleteFiles((event) => {
            event.files.forEach(file => {
                this.cacheService.invalidateFileCache(file.fsPath);
            });
            this.cacheService.invalidateCache();
        });

        this.context.subscriptions.push(fileWatcher, fileCreateWatcher, fileDeleteWatcher);
    }

    async analyzeWorkspace(): Promise<ProjectStats> {
        if (this.isAnalyzing) {
            throw new Error('Analysis already in progress');
        }

        // Check cache first
        const cachedStats = this.cacheService.getCachedProjectStats();
        if (cachedStats) {
            console.log('Returning cached project stats');
            return cachedStats;
        }

        this.isAnalyzing = true;

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            console.log('Starting workspace analysis for:', workspaceFolder.uri.fsPath);

            // Find all files, excluding gitignored and binary files
            const excludePatterns = await this.gitIgnoreService.getExcludePatterns();
            console.log('Using exclude patterns:', excludePatterns);
            
            const allFiles = await vscode.workspace.findFiles('**/*', excludePatterns);
            console.log(`Found ${allFiles.length} files after exclusions`);
            console.log('First 10 files found:', allFiles.slice(0, 10).map(f => f.fsPath));

            // Filter to only text files
            const textFiles = allFiles.filter(file => 
                this.gitIgnoreService.shouldIncludeFile(file.fsPath)
            );
            console.log(`${textFiles.length} files are text files`);
            console.log('First 10 text files:', textFiles.slice(0, 10).map(f => f.fsPath));

            // Get only files that have been modified since last analysis
            const filesToAnalyze = await this.cacheService.getModifiedFiles(textFiles);
            console.log(`${filesToAnalyze.length} files need analysis`);

            const fileStats: FileStats[] = [];
            const cmPerChar = this.getCmPerCharacter();
            console.log('Using cm per character:', cmPerChar);

            // Analyze files in chunks for better performance
            const chunkSize = 50;
            for (let i = 0; i < filesToAnalyze.length; i += chunkSize) {
                const chunk = filesToAnalyze.slice(i, i + chunkSize);
                console.log(`Analyzing chunk ${i / chunkSize + 1}/${Math.ceil(filesToAnalyze.length / chunkSize)}`);
                
                const chunkResults = await Promise.all(
                    chunk.map(file => this.analyzeFile(file, cmPerChar))
                );
                
                fileStats.push(...chunkResults.filter(Boolean) as FileStats[]);
            }

            // Add cached stats for unchanged files
            for (const file of textFiles) {
                if (!filesToAnalyze.includes(file)) {
                    const cachedFileStats = this.cacheService.getCachedFileStats(file.fsPath);
                    if (cachedFileStats) {
                        fileStats.push(cachedFileStats);
                    }
                }
            }

            console.log(`Total analyzed files: ${fileStats.length}`);

            // Build project statistics
            const projectStats = this.buildProjectStats(fileStats);
            
            // Cache the results
            this.cacheService.setCachedProjectStats(projectStats);

            console.log('Workspace analysis completed successfully');
            return projectStats;

        } catch (error) {
            console.error('Error in analyzeWorkspace:', error);
            throw error;
        } finally {
            this.isAnalyzing = false;
        }
    }

    private async analyzeFile(fileUri: vscode.Uri, cmPerChar: number): Promise<FileStats | null> {
        try {
            const stat = await vscode.workspace.fs.stat(fileUri);
            
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const relativePath = workspaceFolder 
                ? vscode.workspace.asRelativePath(fileUri)
                : fileUri.fsPath;

            // Try to read the file to detect if it's text or binary
            let characterCount = 0;
            let isTextFile = false;
            
            try {
                const content = await vscode.workspace.fs.readFile(fileUri);
                const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
                
                // If we get here without throwing, it's a valid text file
                characterCount = text.length;
                isTextFile = true;
            } catch {
                // File is binary or not valid UTF-8
                // We'll still include it but with 0 character count
                characterCount = 0;
                isTextFile = false;
            }

            const fileStats: FileStats = {
                path: fileUri.fsPath,
                relativePath,
                characterCount,
                lengthInCm: isTextFile ? characterCount * cmPerChar : 0,
                fileSize: stat.size,
                lastModified: stat.mtime,
                isTextFile // Add this to track text vs binary
            };

            // Cache individual file stats
            this.cacheService.setCachedFileStats(fileUri.fsPath, fileStats);

            return fileStats;
        } catch (error) {
            console.warn(`Failed to analyze file ${fileUri.fsPath}:`, error);
            return null;
        }
    }

    private buildProjectStats(fileStats: FileStats[]): ProjectStats {
        const filesByExtension = new Map<string, FileStats[]>();
        let totalCharacters = 0;
        let totalLengthInCm = 0;
        let totalSizeInBytes = 0;

        for (const file of fileStats) {
            totalCharacters += file.characterCount;
            totalLengthInCm += file.lengthInCm;
            totalSizeInBytes += file.fileSize;

            // Group by extension
            const extension = this.getFileExtension(file.path);
            if (!filesByExtension.has(extension)) {
                filesByExtension.set(extension, []);
            }
            filesByExtension.get(extension)!.push(file);
        }

        return {
            totalFiles: fileStats.length,
            totalCharacters,
            totalLengthInCm,
            totalSizeInBytes,
            filesByExtension,
            lastUpdated: Date.now()
        };
    }

    getFileTypeStats(projectStats: ProjectStats): FileTypeStats[] {
        const stats: FileTypeStats[] = [];

        for (const [extension, files] of projectStats.filesByExtension.entries()) {
            const totalChars = files.reduce((sum, f) => sum + f.characterCount, 0);
            const totalLength = files.reduce((sum, f) => sum + f.lengthInCm, 0);

            stats.push({
                extension,
                fileCount: files.length,
                totalCharacters: totalChars,
                totalLengthInCm: totalLength,
                averageLengthInCm: totalLength / files.length,
                files: files.sort((a, b) => b.lengthInCm - a.lengthInCm) // Sort by length desc
            });
        }

        return stats.sort((a, b) => b.totalLengthInCm - a.totalLengthInCm);
    }

    private getFileExtension(filePath: string): string {
        const lastDot = filePath.lastIndexOf('.');
        if (lastDot === -1) {
            return 'No extension';
        }
        return filePath.substring(lastDot);
    }

    invalidateCache(): void {
        this.cacheService.invalidateCache();
    }

    dispose(): void {
        // Clean up any resources if needed
        this.invalidateCache();
    }
}
