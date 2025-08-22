import * as vscode from 'vscode';

export class GitIgnoreService {
    private gitignorePatterns: string[] = [];
    private workspaceRoot: string;
    private initialized = false;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        // Don't call async method in constructor
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.loadGitignorePatterns();
            this.initialized = true;
        }
    }

    private async loadGitignorePatterns(): Promise<void> {
        try {
            const gitignoreUri = vscode.Uri.file(`${this.workspaceRoot}/.gitignore`);
            const gitignoreContent = await vscode.workspace.fs.readFile(gitignoreUri);
            const content = new TextDecoder().decode(gitignoreContent);
            
            this.gitignorePatterns = content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
        } catch {
            // No .gitignore file or couldn't read it
            this.gitignorePatterns = [];
        }
    }

    /**
     * Get exclude patterns for vscode.workspace.findFiles()
     * Combines gitignore patterns with common patterns to exclude
     */
    async getExcludePatterns(): Promise<string> {
        await this.ensureInitialized();
        
        const defaultExcludes = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/out/**',
            '**/.git/**',
            '**/.*', // Hidden files
            '**/*.jpg',
            '**/*.jpeg', 
            '**/*.png',
            '**/*.gif',
            '**/*.bmp',
            '**/*.ico',
            '**/*.svg',
            '**/*.webp',
            '**/*.mp4',
            '**/*.avi',
            '**/*.mov',
            '**/*.wmv',
            '**/*.flv',
            '**/*.webm',
            '**/*.mp3',
            '**/*.wav',
            '**/*.flac',
            '**/*.aac',
            '**/*.ogg',
            '**/*.zip',
            '**/*.rar',
            '**/*.7z',
            '**/*.tar',
            '**/*.gz',
            '**/*.bz2',
            '**/*.exe',
            '**/*.dll',
            '**/*.so',
            '**/*.dylib',
            '**/*.pdf',
            '**/*.doc',
            '**/*.docx',
            '**/*.xls',
            '**/*.xlsx',
            '**/*.ppt',
            '**/*.pptx'
        ];

        // Convert gitignore patterns to VS Code glob patterns
        const gitignoreGlobs = this.gitignorePatterns.map(pattern => {
            // Simple conversion - could be more sophisticated
            if (pattern.endsWith('/')) {
                return `**/${pattern}**`;
            }
            return `**/${pattern}`;
        });

        const allPatterns = [...defaultExcludes, ...gitignoreGlobs];
        return `{${allPatterns.join(',')}}`;
    }

    /**
     * Check if a file should be included for analysis
     * Now we include all files, but we'll handle text vs binary in the analysis
     */
    shouldIncludeFile(_filePath: string): boolean {
        // Include all files - we'll detect text vs binary during analysis
        return true;
    }
}
