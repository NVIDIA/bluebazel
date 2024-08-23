import * as vscode from 'vscode';

export class WorkspaceService {
    // Static instance for singleton pattern
    private static instance: WorkspaceService;

    // Cached workspace folder
    private workspaceFolder: vscode.WorkspaceFolder;

    // Private constructor to prevent direct instantiation
    private constructor() {
        this.workspaceFolder = this.initializeWorkspaceFolder();
    }

    // Static method to get the singleton instance
    public static getInstance(): WorkspaceService {
        if (!WorkspaceService.instance) {
            WorkspaceService.instance = new WorkspaceService();
        }
        return WorkspaceService.instance;
    }

    // Method to initialize and cache the workspace folder
    private initializeWorkspaceFolder(): vscode.WorkspaceFolder {
        const paths = vscode.workspace.workspaceFolders;
        if (paths && paths.length > 0) {
            return paths[0];
        } else {
            vscode.window.showErrorMessage('Could not find workspace.');
            return {
                uri: vscode.Uri.file('.'),
                index: 0,
                name: 'none'
            };
        }
    }

    // Public method to get the cached workspace folder
    public getWorkspaceFolder(): vscode.WorkspaceFolder {
        return this.workspaceFolder;
    }
}