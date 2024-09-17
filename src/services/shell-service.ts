
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