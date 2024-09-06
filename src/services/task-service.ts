import * as vscode from 'vscode';

import { ExtensionUtils } from './extension-utils';
import { clearTerminal } from '../ui/terminal';
import { showProgress } from '../ui/progress';

export class TaskService {

    constructor(private readonly context: vscode.ExtensionContext,
        private readonly workspaceFolder: vscode.WorkspaceFolder,
        private readonly setupEnvVars: {[key: string]: string}) { }


    public static generateUniqueTaskSource(context: vscode.ExtensionContext) {
        return ExtensionUtils.getExtensionName(context) + this.getRandomInt(100000);
    }

    public async runTask(taskType: string, taskName: string, command: string, clearTerminalFirst: boolean, envVars: { [key: string]: string } = {}, executionType: 'shell' | 'process' = 'shell') {
        const workspaceFolder = this.workspaceFolder;

        const envVarsObj = { ...this.setupEnvVars, ...envVars };
        let execution: vscode.ShellExecution | vscode.ProcessExecution;
        if (executionType === 'shell') {
            execution = new vscode.ShellExecution(command, { cwd: workspaceFolder.uri.path, env: envVarsObj });
        } else {
            const args = command.split(' ');
            execution = new vscode.ProcessExecution(args[0], args.slice(1), { cwd: workspaceFolder.uri.path, env: envVarsObj });
        }

        const task = new vscode.Task(
            { type: taskType },
            workspaceFolder,
            taskName,
            TaskService.generateUniqueTaskSource(this.context),
            execution,
            '$gcc'  // Adjust this as necessary
        );

        if (clearTerminalFirst) {
            clearTerminal();
        }

        const taskExecution = await vscode.tasks.executeTask(task);
        return this.showProgressOfTask(taskName, taskExecution);
    }

    private static getRandomInt(max: number) {
        return Math.floor(Math.random() * Math.floor(max));
    }

    private showProgressOfTask(title: string, execution: vscode.TaskExecution) {
        return showProgress(title, (cancellationToken) => {
            return new Promise<void>((resolve, reject) => {
                const disposable = vscode.tasks.onDidEndTask(e => {
                    if (e.execution === execution) {
                        disposable.dispose();
                        resolve();
                    }
                });

                cancellationToken.onCancellationRequested(() => {
                    execution.terminate();
                    reject(new Error(`${title} cancelled.`));
                });
            });
        });
    }
}