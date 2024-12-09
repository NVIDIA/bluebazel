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

import { Console } from '../services/console';
import { ExtensionUtils } from '../services/extension-utils';
import * as vscode from 'vscode';


export class WorkspaceStateManager {
    private versionChangeHappened = false;
    private majorVersionChangeHappened = false;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.versionChangeHappened = this.checkVersionChange();
        this.majorVersionChangeHappened = this.checkVersionChange(true);
    }


    private checkVersionChange(majorVersionOnly = false): boolean {
        const version = ExtensionUtils.getExtensionVersion(this.context);
        const oldVersion = this.context.workspaceState.get<string>('version', '');
        if (majorVersionOnly) {
            const majorOld = oldVersion.split('.')[0];
            const majorNew = version.split('.')[0];
            return majorOld !== majorNew;
        }
        return oldVersion !== version;
    }

    public versionChanged(): boolean {
        return this.versionChangeHappened;
    }

    public majorVersionChanged(): boolean {
        return this.majorVersionChangeHappened;
    }

    public refreshWorkspaceState() {
        if (this.majorVersionChanged()) {
            this.clearWorkspaceState();
            this.context.workspaceState.update('version', ExtensionUtils.getExtensionVersion(this.context));
            Console.info('Workspace state has been cleared due to major version bump.');
        }
    }

    private clearWorkspaceState() {
        const keys = this.context.workspaceState.keys();
        for (const key of keys) {
            this.context.workspaceState.update(key, undefined);
        }
    }

    public update<T>(key: string, value: T) {
        this.context.workspaceState.update(key, value);
    }

    public get<T>(key: string, defaultValue: T): T {
        return this.context.workspaceState.get(key, defaultValue);
    }
}