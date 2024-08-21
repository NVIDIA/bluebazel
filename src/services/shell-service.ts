
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

import { showProgress } from '../ui/progress';
import * as child from 'child_process';
import * as vscode from 'vscode';

export class ShellService {

    constructor(private readonly workspaceFolder: vscode.WorkspaceFolder,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly setupEnvVars: {[key: string]: string}
    ) {}


    public static async run(cmd: string, cwd: string, setupEnvVars: {[key: string]: string}, showOutput = false, outputChannel: vscode.OutputChannel | undefined = undefined, title = ''): Promise<{ stdout: string, stderr: string }> {
        if (outputChannel !== undefined) {
            outputChannel.clear();
            outputChannel.appendLine(`Running shell command: ${cmd}`);
            if (showOutput) {
                outputChannel.show();
            }
        }

        if (title === '') {
            title = cmd;
        }
        return showProgress(title, (cancellationToken): Promise<{ stdout: string, stderr: string }> => {
            return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
                const execOptions: child.ExecOptions = {
                    cwd: cwd,
                    shell: 'bash',
                    maxBuffer: Number.MAX_SAFE_INTEGER,
                    windowsHide: false,
                    env: {...process.env, ...setupEnvVars}
                };

                const proc = child.exec(`${cmd}`, execOptions,
                    (error: child.ExecException | null, stdout: string, stderr: string) => {
                        if (error && error.code != 1) { // Error code 1 indicates grep couldn't find any matches
                            vscode.window.showErrorMessage(error.message);
                            resolve({ stdout: '', stderr: stderr });
                        } else {
                            resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
                        }
                    },
                );

                if (outputChannel !== undefined) {
                    proc.stdout?.on('data', (data) => { outputChannel.appendLine(data); });
                    proc.stderr?.on('data', (data) => { outputChannel.appendLine(data); });
                }

                if (cancellationToken) {
                    cancellationToken.onCancellationRequested(() => {
                        proc.kill();
                        reject(new Error(`${cmd} cancelled.`));
                    });
                }

            });
        });
    }

    public async runShellCommand(cmd: string, showOutput: boolean, title = ''): Promise<{ stdout: string, stderr: string }> {
        return ShellService.run(cmd, this.workspaceFolder.uri.path, this.setupEnvVars, showOutput, this.outputChannel, title);
    }
}