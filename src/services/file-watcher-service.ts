////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2024 NVIDIA Corporation
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
////////////////////////////////////////////////////////////////////////////////////

import * as vscode from 'vscode';

export class FileWatcherService {
    private watchers: vscode.FileSystemWatcher[] = [];

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Adds a watcher for a specific file pattern with custom callbacks.
     * @param pattern Glob pattern to match files
     * @param onCreate Callback for file creation events
     * @param onChange Callback for file change events
     * @param onDelete Callback for file deletion events
     */
    public watch(
        pattern: string,
        onCreate: (uri: vscode.Uri) => void,
        onChange: (uri: vscode.Uri) => void,
        onDelete: (uri: vscode.Uri) => void
    ): void {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        // Register event listeners with the provided callbacks
        watcher.onDidCreate(onCreate, this.context.subscriptions);
        watcher.onDidChange(onChange, this.context.subscriptions);
        watcher.onDidDelete(onDelete, this.context.subscriptions);

        // Store the watcher for disposal later
        this.watchers.push(watcher);
        this.context.subscriptions.push(watcher);
    }

    /**
     * Disposes of all file watchers to release resources.
     */
    public dispose(): void {
        this.watchers.forEach((watcher) => watcher.dispose());
        this.watchers = [];
    }
}
