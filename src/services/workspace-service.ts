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

import * as fs from 'fs';
import * as path from 'path';
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

    public async getSubdirectoryPaths(root = '') {
        const all = '/' + path.join('/', root, '...');
        const absoluteRoot = path.join(WorkspaceService.getInstance().getWorkspaceFolder().uri.path, root);

        return fs.promises.readdir(absoluteRoot, { withFileTypes: true }).then((data) => {
            const res: string[] = new Array(data.length + 1);
            let index = 0;
            res[index++] = all;
            // The first entry is always all.
            return Promise.all(data.map(async (element) => {
                if (element.isDirectory() && element.name[0] !== '.') {
                    res[index++] = '/' + path.join('/', root, element.name);
                }
            })).then(() => { return res.slice(0, index); });
        });
    }
}