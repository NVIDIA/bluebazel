
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

import * as child from 'child_process';
import * as vscode from 'vscode';

export interface ProcessOutput {
    stdout: string,
    stderr: string,
    exitCode: number
}

export class ShellService {

    constructor(private readonly workspaceFolder: vscode.WorkspaceFolder,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly setupEnvVars: {[key: string]: string}
    ) { }

    public static async run(
        cmd: string,
        cwd: string,
        setupEnvVars: { [key: string]: string },
        cancellationToken?: vscode.CancellationToken,
        outputChannel?: vscode.OutputChannel
    ): Promise<ProcessOutput> {
        return new Promise<ProcessOutput>((resolve, reject) => {
            const execOptions: child.ExecOptions = {
                cwd: cwd,
                shell: 'bash',
                maxBuffer: Number.MAX_SAFE_INTEGER,
                windowsHide: false,
                env: { ...process.env, ...setupEnvVars }
            };

            const proc = child.exec(cmd, execOptions);

            let stdout = '';
            let stderr = '';

            // Capture stdout line-by-line
            proc.stdout?.on('data', (data: string) => {
                stdout += data;
                const lines = data.split('\n'); // Split the incoming data into lines
                lines.forEach(line => {
                    if (outputChannel) {
                        outputChannel.appendLine(line); // Append each line to the output channel
                    }
                });
            });

            // Capture stderr line-by-line
            proc.stderr?.on('data', (data: string) => {
                stderr += data;
                const lines = data.split('\n'); // Split the incoming data into lines
                lines.forEach(line => {
                    if (outputChannel) {
                        outputChannel.appendLine(line); // Append each line to the output channel
                    }
                });
            });

            proc.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Error running ${cmd} exited with code: ${code}`));
                }
                resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code || 0 });
            });

            // Handle process errors
            proc.on('error', (err) => {
                reject(err);
            });

            // Handle cancellation
            if (cancellationToken) {
                cancellationToken.onCancellationRequested(() => {
                    proc.kill();
                    reject(new Error(`${cmd} cancelled.`));
                });
            }
        });
    }

    public async runShellCommand(cmd: string, cancellationToken?: vscode.CancellationToken): Promise<{ stdout: string, stderr: string }> {
        return ShellService.run(cmd, this.workspaceFolder.uri.path, this.setupEnvVars, cancellationToken, this.outputChannel);
    }
}