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

import { EnvVarsUtils } from './env-vars-utils';
import { ExtensionUtils } from './extension-utils';
import { showProgress } from '../ui/progress';
import { clearTerminal } from '../ui/terminal';
import * as vscode from 'vscode';


export class CustomTaskProvider implements vscode.TaskProvider {
    static readonly type = 'bluebazelTask';

    provideTasks(): vscode.Task[] | undefined {
        return undefined;  // You can provide predefined tasks if needed.
    }

    resolveTask(task: vscode.Task): vscode.Task | undefined {
        return task;  // Just return the task as-is for simplicity.
    }
}

export class TaskService {

    constructor(private readonly context: vscode.ExtensionContext,
        private readonly workspaceFolder: vscode.WorkspaceFolder,
        private readonly setupEnvVars: string[]) {
        const customTaskProvider = vscode.tasks.registerTaskProvider(CustomTaskProvider.type, new CustomTaskProvider());
        context.subscriptions.push(customTaskProvider);
    }


    public async runTask(taskName: string,
        command: string,
        clearTerminalFirst: boolean,
        id = '', envVars: { [key: string]: string } = {},
        executionType: 'shell' | 'process' = 'shell',
        resolveOn: 'onDidStartTask' | 'onDidEndTask' = 'onDidEndTask',
        problemMatcher = '$gcc',
        showProgress = true) {
        const workspaceFolder = this.workspaceFolder;

        const envVarsObj = { ...EnvVarsUtils.listToObject(this.setupEnvVars), ...envVars };
        let execution: vscode.ShellExecution | vscode.ProcessExecution | vscode.CustomExecution;
        if (executionType === 'shell') {
            execution = new vscode.ShellExecution(command, {
                cwd: workspaceFolder.uri.path, env: envVarsObj,
                executable: '/bin/bash',  // Ensure bash is used as the shell
                shellArgs: ['-c'] });
        } else {
            const args = command.split(' ');
            execution = new vscode.ProcessExecution(args[0], args.slice(1), { cwd: workspaceFolder.uri.path, env: envVarsObj });
        }

        const taskType = `${CustomTaskProvider.type}-${taskName}-${id}`;  // Dynamically set the task type
        const task = new vscode.Task(
            { type: taskType },
            workspaceFolder,
            taskName,
            ExtensionUtils.getExtensionDisplayName(this.context),
            execution,
            problemMatcher  // Adjust this as necessary
        );

        task.presentationOptions = {
            reveal: vscode.TaskRevealKind.Always,
            panel: vscode.TaskPanelKind.Dedicated
        };
        if (clearTerminalFirst) {
            clearTerminal();
        }

        const taskExecution = await vscode.tasks.executeTask(task);
        if (showProgress) {
            return this.showProgressOfTask(taskName, taskExecution, resolveOn);
        } else {
            return taskExecution;
        }
    }

    private showProgressOfTask(title: string, execution: vscode.TaskExecution, resolveOn: 'onDidStartTask' | 'onDidEndTask' = 'onDidEndTask') {
        return showProgress(title, (cancellationToken) => {
            return new Promise<vscode.TaskExecution>((resolve, reject) => {
                // if (resolveOn === 'onDidEndTask') {
                const disposable = vscode.tasks.onDidEndTask(e => {
                    if (e.execution === execution) {
                        disposable.dispose();
                        resolve(e.execution);
                    }
                });
                // }
                if (resolveOn === 'onDidStartTask') {
                    const disposable = vscode.tasks.onDidStartTask(e => {
                        if (e.execution === execution) {
                            disposable.dispose();
                            resolve(e.execution);
                        }
                    });
                }

                cancellationToken.onCancellationRequested(() => {
                    execution.terminate();
                    reject(new Error(`${title} cancelled.`));
                });
            });
        });
    }
}
