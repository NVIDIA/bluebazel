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

import { BazelTarget } from '../models/bazel-target';
import { BazelTargetManager } from '../models/bazel-target-manager';
import { BazelService } from '../services/bazel-service';
import { ConfigurationManager } from '../services/configuration-manager';
import { Console } from '../services/console';
import { FileWatcherService } from '../services/file-watcher-service';
import { TaskService } from '../services/task-service';
import { WorkspaceService } from '../services/workspace-service';
import { BazelTargetTreeProvider, BazelTreeElement } from '../ui/bazel-target-tree-provider';
import { showProgress } from '../ui/progress';
import * as path from 'path';
import * as vscode from 'vscode';


export class BazelController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        fileWatcherService: FileWatcherService,
        private readonly taskService: TaskService,
        private readonly bazelService: BazelService,
        private readonly bazelTargetManager: BazelTargetManager,
        private readonly bazelTreeProvider: BazelTargetTreeProvider
    ) {
        if (this.configurationManager.shouldRefreshTargetsOnFileChange()) {
            fileWatcherService.watch('**/BUILD{,.bazel}',
                (affectedFiles: string[]) => {
                    Console.log(`BUILD files affected: ${affectedFiles.length}`);
                    this.refreshAvailableTargets(affectedFiles);
                }
            );
        }

        if (this.configurationManager.shouldRefreshTargetsOnWorkspaceOpen() ||
         !this.bazelTargetManager.hasCache()) {
            this.refreshAvailableTargets().catch(error => {
                vscode.window.showErrorMessage(`Cannot update available targets: ${error}`);
            });
        }
    }

    public async format() {
        return showProgress('Formatting', (cancellationToken) => {
            const executable = this.configurationManager.getExecutableCommand();
            const cmd = this.configurationManager.getFormatCommand();
            return this.taskService.runTask('format', `${executable} ${cmd}`, this.configurationManager.isClearTerminalBeforeAction(), cancellationToken);
        });
    }

    public async clean() {
        const executable = this.configurationManager.getExecutableCommand();
        vscode.window.showWarningMessage(`Are you sure you want to ${executable} clean your project?`,
            { modal: true },
            'OK'
        ).then((selection) => {
            if (selection === 'OK') {
                // Perform the clean action
                return showProgress('Cleaning', (cancellationToken) => {
                    const executable = this.configurationManager.getExecutableCommand();
                    return this.taskService.runTask(
                        'clean', // task name
                        `${executable} clean`,
                        this.configurationManager.isClearTerminalBeforeAction(),
                        cancellationToken
                    );
                });
            }
        });

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

        // Build single file command
        return showProgress(`Building ${filePath}`, (cancellationToken) => {
            const executable = this.configurationManager.getExecutableCommand();
            return this.taskService.runTask(
                'build', // task name
                `${executable} build --compile_one_dependency ${filePath}`,
                this.configurationManager.isClearTerminalBeforeAction(),
                cancellationToken,
                filePath
            );
        });
    }

    public async refreshAvailableTargets(_affectedFiles?: string[]): Promise<void> {
        // TODO: In the future, use uri to only update the available targets based on
        // uri if present in an append mode.
        return showProgress('Updating available targets', async (cancellationToken) => {
            try {
                const timeoutMs = this.configurationManager.getRefreshTargetsTimeoutMs();
                const targets = await this.bazelService.fetchAllTargetsByAction(cancellationToken, timeoutMs);
                await this.bazelTargetManager.updateAvailableTargets(targets);
                vscode.window.showInformationMessage('Updated available targets');
            } catch (error) {
                Console.error(error);
                return Promise.reject(error);
            }
        }, undefined, true);
    }

    public onTreeSelectionChanged(event: vscode.TreeViewSelectionChangeEvent<BazelTreeElement>) {
        const selectedItems = event.selection;

        if (selectedItems.length === 0) {
            return;
        }

        selectedItems.forEach((element) => {
            if (element instanceof BazelTarget) {
                this.bazelTargetManager.updateSelectedTarget(element);
                this.bazelTreeProvider.refresh();
            }
        });
    }
}