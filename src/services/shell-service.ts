
import * as vscode from 'vscode';
import * as child from 'child_process';
import { showProgress } from '../ui/progress';

export class ShellService {

    constructor(private readonly workspaceFolder: vscode.WorkspaceFolder,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly setupEnvVars: {[key: string]: string}
    ) {}


    public async runShellCommand(cmd: string, showOutput: boolean): Promise<{ stdout: string }> {

        this.outputChannel.clear();
        this.outputChannel.appendLine(`Running shell command: ${cmd}`);

        if (showOutput) {
            this.outputChannel.show();
        }

        return showProgress(cmd, (cancellationToken): Promise<{ stdout: string }> => {
            return new Promise<{ stdout: string }>((resolve, reject) => {
                const execOptions: child.ExecOptions = {
                    cwd: this.workspaceFolder.uri.path,
                    shell: 'bash',
                    maxBuffer: Number.MAX_SAFE_INTEGER,
                    windowsHide: false,
                    env: {...process.env, ...this.setupEnvVars}
                };

                const proc = child.exec(`${cmd}`, execOptions,
                    (error: child.ExecException | null, stdout: string, stderr: string) => {
                        if (error && error.code != 1) { // Error code 1 indicates grep couldn't find any matches
                            vscode.window.showErrorMessage(error.message);
                            resolve({ stdout: '' });
                        } else {

                            resolve({ stdout: stdout.trim() });
                        }
                    },
                );

                proc.stdout?.on('data', (data) => { this.outputChannel.appendLine(data); });
                proc.stderr?.on('data', (data) => { this.outputChannel.appendLine(data); });

                if (cancellationToken) {
                    cancellationToken.onCancellationRequested(() => {
                        proc.kill();
                        reject(new Error(`${cmd} cancelled.`));
                    });
                }

            });
        });
    }
}