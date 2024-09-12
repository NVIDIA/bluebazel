/////////////////////////////////////////////////////////////////////////////////////////
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
/////////////////////////////////////////////////////////////////////////////////////////

import { BazelEnvironment } from '../models/bazel-environment';
import { BazelTarget } from '../models/bazel-target';
import { BazelService } from '../services/bazel-service';
import { ConfigurationManager } from '../services/configuration-manager';
import { TaskService } from '../services/task-service';
import { WorkspaceService } from '../services/workspace-service';
import * as path from 'path';
import * as vscode from 'vscode';


export class BazelController {
    private isRefreshingRunTargets: boolean;
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly bazelService: BazelService,
        private readonly bazelEnvironment: BazelEnvironment
    ) {
        this.isRefreshingRunTargets = false;
     }

    public async format() {
        const executable = this.configurationManager.getExecutableCommand();
        const cmd = this.configurationManager.getFormatCommand();
        return this.taskService.runTask('format', 'format', `${executable} ${cmd}`, this.configurationManager.isClearTerminalBeforeAction());
    }

    public async clean() {
        const executable = this.configurationManager.getExecutableCommand();
        await this.taskService.runTask(
            'clean', // task type
            'clean', // task name
            `${executable} clean`,
            this.configurationManager.isClearTerminalBeforeAction()
        );
    }

    public async buildSingle() {
        // Get current open file.
        const textEditor = vscode.window.activeTextEditor;
        if (textEditor === undefined) {
            vscode.window.showErrorMessage('Build failed. There is no active text editor.');
            return;
        }

        let filePath = textEditor.document.uri.fsPath;
        // Get relative path from the workspace
        filePath = path.relative(WorkspaceService.getInstance().getWorkspaceFolder().uri.fsPath, filePath);

        // Check if there are any `..`, as this would indicate we are outside of the workspace
        if (filePath.includes('..')) {
            vscode.window.showErrorMessage('Build failed. Please open a file in the current workspace.');
            return;
        }

        // Build command
        const executable = this.configurationManager.getExecutableCommand();
        await this.taskService.runTask(
            `build ${filePath}`, // task type
            `build ${filePath}`, // task name
            `${executable} build --compile_one_dependency ${filePath}`,
            this.configurationManager.isClearTerminalBeforeAction()
        );
    }

    public async refreshRunTargets(): Promise<void> {
        if (this.isRefreshingRunTargets) {
            vscode.window.showWarningMessage('Run targets are still being refreshed...');
            return Promise.resolve();
        }
        else {

            this.isRefreshingRunTargets = true;
            this.bazelService.fetchRunTargets().then(
                (data) => {
                    const bazelTargets: BazelTarget[] = [];
                    data.forEach(item => {
                        bazelTargets.push(new BazelTarget(this.context, item.label, item.detail, 'run'));
                    });
                    this.bazelEnvironment.updateRunTargets(bazelTargets);
                    this.isRefreshingRunTargets = false;
                }
            );
        }
    }

}