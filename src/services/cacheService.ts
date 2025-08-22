import * as vscode from 'vscode';
import { FileStats, ProjectStats } from '../models/fileStats';

export class CacheService {
    private projectStatsCache: ProjectStats | null = null;
    private fileStatsCache = new Map<string, FileStats>();
    private cacheTimestamp = 0;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    constructor(private context: vscode.ExtensionContext) {}

    getCachedProjectStats(): ProjectStats | null {
        if (this.isCacheValid()) {
            return this.projectStatsCache;
        }
        return null;
    }

    setCachedProjectStats(stats: ProjectStats): void {
        this.projectStatsCache = stats;
        this.cacheTimestamp = Date.now();
    }

    getCachedFileStats(filePath: string): FileStats | null {
        return this.fileStatsCache.get(filePath) || null;
    }

    setCachedFileStats(filePath: string, stats: FileStats): void {
        this.fileStatsCache.set(filePath, stats);
    }

    invalidateCache(): void {
        this.projectStatsCache = null;
        this.fileStatsCache.clear();
        this.cacheTimestamp = 0;
    }

    invalidateFileCache(filePath: string): void {
        this.fileStatsCache.delete(filePath);
        // If a file changes, invalidate the project cache too
        this.projectStatsCache = null;
    }

    private isCacheValid(): boolean {
        return this.cacheTimestamp > 0 && 
               (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
    }

    /**
     * Get files that have been modified since the last cache update
     */
    async getModifiedFiles(allFiles: vscode.Uri[]): Promise<vscode.Uri[]> {
        if (!this.projectStatsCache) {
            return allFiles; // No cache, all files are "modified"
        }

        const modifiedFiles: vscode.Uri[] = [];
        
        for (const file of allFiles) {
            try {
                const stat = await vscode.workspace.fs.stat(file);
                const cachedStats = this.fileStatsCache.get(file.fsPath);
                
                if (!cachedStats || stat.mtime > cachedStats.lastModified) {
                    modifiedFiles.push(file);
                }
            } catch {
                // File might not exist anymore or can't be accessed
                modifiedFiles.push(file);
            }
        }

        return modifiedFiles;
    }
}
