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
    private allAffectedFiles = new Set<string>(); // Preserve all affected files globally

    constructor(private context: vscode.ExtensionContext) {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
        let timeout: NodeJS.Timeout;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return ((...args: any[]) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        }) as T;
    }

    /**
     * Adds a watcher for a specific file pattern and fires a single event with affected file names when any matching files are created, updated, or deleted.
     * @param pattern Glob pattern to match files
     * @param onFilesChanged Callback triggered when any files matching the pattern are created, changed, or deleted.
     */
    public watch(
        pattern: string,
        onFilesChanged: (affectedFiles: string[]) => void
    ): void {
        // Debounced callback to process the collected file paths
        const processEvents = FileWatcherService.debounce(() => {
            if (this.allAffectedFiles.size > 0) {
                onFilesChanged(Array.from(this.allAffectedFiles)); // Pass all files
                this.allAffectedFiles.clear(); // Clear after processing
            }
        }, 500);

        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        // Collect affected files for each event and ensure they persist across debounce calls
        const addAffectedFile = (uri: vscode.Uri) => {
            this.allAffectedFiles.add(uri.fsPath); // Add to global set
            processEvents(); // Trigger the debounced callback
        };

        watcher.onDidCreate(addAffectedFile, this.context.subscriptions);
        watcher.onDidChange(addAffectedFile, this.context.subscriptions);
        watcher.onDidDelete(addAffectedFile, this.context.subscriptions);

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

