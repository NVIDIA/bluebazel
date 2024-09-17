import * as vscode from 'vscode';

export class WorkspaceStateManager {
    constructor(private readonly context: vscode.ExtensionContext) {}

    public refreshWorkspaceState(version: string) {
        const oldVersion = this.context.workspaceState.get<string>('version', '');
        if (oldVersion !== version) {
            this.clearWorkspaceState();
            this.context.workspaceState.update('version', version);
        }
    }

    private clearWorkspaceState() {
        const keys = this.context.workspaceState.keys();
        for (const key of keys) {
            this.context.workspaceState.update(key, undefined);
        }
        console.info('Workspace state has been cleared due to version bump.');
    }

    public update<T>(key: string, value: T) {
        this.context.workspaceState.update(key, value);
    }

    public get<T>(key: string, defaultValue: T): T {
        return this.context.workspaceState.get(key, defaultValue);
    }
}