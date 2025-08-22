export interface FileStats {
    path: string;
    relativePath: string;
    characterCount: number;
    lengthInCm: number;
    fileSize: number;
    lastModified: number;
}

export interface ProjectStats {
    totalFiles: number;
    totalCharacters: number;
    totalLengthInCm: number;
    totalSizeInBytes: number;
    filesByExtension: Map<string, FileStats[]>;
    lastUpdated: number;
}

export interface FileTypeStats {
    extension: string;
    fileCount: number;
    totalCharacters: number;
    totalLengthInCm: number;
    averageLengthInCm: number;
    files: FileStats[];
}

export interface FolderStats {
    path: string;
    name: string;
    totalFiles: number;
    totalCharacters: number;
    totalLengthInCm: number;
    files: FileStats[];
    subfolders: FolderStats[];
}
