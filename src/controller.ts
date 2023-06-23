/////////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2023 NVIDIA Corporation
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

import * as vscode from 'vscode';
import * as path from 'path';
import * as child from 'child_process';
import * as fs from 'fs';
import * as common from './common';
import { ConfigurationManager } from './configurationManager';
import { BazelModel } from './model';
// eslint-disable-next-line
// @ts-ignore
import { sync as isExecutable } from 'executable';

interface RunTarget {
    label: string,
    value: string
}

export class BazelController {

    static TaskSource = 'Blue Bazel';
    static RunTargets = 'BazelRunTargets';

    private m_workspaceFolder: vscode.WorkspaceFolder;

    private m_runTargets: vscode.QuickPickItem[] = [];
    private m_isRefreshingRunTargets = false;

    private m_configuration: ConfigurationManager;
    private m_outputChannel: vscode.OutputChannel;

    constructor(
        private readonly workspaceState: vscode.Memento,
        configurationManager: ConfigurationManager,
        private readonly model: BazelModel) {
        this.m_outputChannel = vscode.window.createOutputChannel('Blue Bazel');
        this.m_configuration = configurationManager;

        const paths = vscode.workspace.workspaceFolders;

        if (paths !== undefined) {
            this.m_workspaceFolder = paths[0];
        } else {
            this.m_workspaceFolder = {
                uri: vscode.Uri.file('.'),
                index: 0,
                name: 'none'
            };

            vscode.window.showErrorMessage('Could not find workspace.');
        }

        // Load the run targets
        const targets: vscode.QuickPickItem[] | undefined = this.workspaceState.get<vscode.QuickPickItem[]>(BazelController.RunTargets);
        if (targets !== undefined) {
            this.m_runTargets = targets;
        }

        this.updateSetupEnvVars();
    }

    private updateSetupEnvVars() {
        this.model.update(common.WORKSPACE_KEYS.setupEnvVars, '');
        const envSetupCommand = this.m_configuration.getSetupEnvironmentCommand();
        const envDelimiter = '---bluebazel setup---';
        if (envSetupCommand) {
            this.runShellCommand(`${envSetupCommand} && echo ${envDelimiter} && printenv`, false).then((value) => {
                const env = value.stdout.replace(new RegExp(`[\\s\\S]*?${envDelimiter}\n`, 'g'), '').split('\n');
                const envArray: string[] = [];
                let currentVariable = '';
                for (const line of env) {
                    if (line.includes('=')) {
                        if (currentVariable) {
                            const [name, value] = currentVariable.split('=');
                            envArray.push(`${name}=${value}`);
                        }
                        currentVariable = line;
                    } else if (currentVariable) {
                        currentVariable += `\n${line}`;
                    }
                }

                if (currentVariable) {
                    const [name, value] = currentVariable.split('=');
                    envArray.push(`${name}=${value}`);
                }

                this.model.update(common.WORKSPACE_KEYS.setupEnvVars, envArray);
            });
        }
    }

    private getTaskSource(): string {
        return BazelController.TaskSource + this.getRandomInt(100000);
    }

    public async buildTarget(target: string) {
        let actualTarget = target;
        if (target === common.BUILD_RUN_TARGET_STR) {
            // Find run target
            const runTarget = this.workspaceState.get<RunTarget>(common.WORKSPACE_KEYS.runTarget);
            if (runTarget !== undefined &&
                typeof runTarget === 'object' &&
                runTarget !== null &&
                Object.keys(runTarget).includes('value')) {
                actualTarget = path.relative(common.BAZEL_BIN, runTarget.value);
            } else {
                vscode.window.showErrorMessage('Build failed. Could not find run target.');
                return;
            }
        }

        const buildArgs = this.model.getBazelBuildArgs();
        const configArgs = this.model.getBuildConfigArgs();
        const buildEnvVars = this.model.getBuildEnvVariables();
        const executable = this.m_configuration.getExecutableCommand();
        const setupEnvVars = this.model.getSetupEnvVariablesAsObject();
        const task = new vscode.Task(
            {
                type: `build ${actualTarget}`
            },
            this.m_workspaceFolder,
            `build ${actualTarget}`, this.getTaskSource(),
            new vscode.ShellExecution(`${executable} build ${buildArgs} ${configArgs} ${actualTarget} ${buildEnvVars}\n`, { cwd: this.m_workspaceFolder.uri.path, env: setupEnvVars }),
            '$gcc'
        );

        if (this.m_configuration.isClearTerminalBeforeAction()) {
            this.clearTerminal();
        }


        const execution = await vscode.tasks.executeTask(task);
        return this.showProgressOfTask(`build ${actualTarget}`, execution);
    }


    public async format() {
        const executable = this.m_configuration.getExecutableCommand();
        const cmd = this.m_configuration.getFormatCommand();
        const setupEnvVars = this.model.getSetupEnvVariablesAsObject();
        const task = new vscode.Task(
            {
                type: 'format'
            },
            this.m_workspaceFolder,
            'format', this.getTaskSource(),
            new vscode.ShellExecution(`${executable} ${cmd}`, { cwd: this.m_workspaceFolder.uri.path, env: setupEnvVars }),
            '$gcc'
        );

        if (this.m_configuration.isClearTerminalBeforeAction()) {
            this.clearTerminal();
        }

        const execution = await vscode.tasks.executeTask(task);
        this.showProgressOfTask('format', execution);
    }

    public async clean() {
        const executable = this.m_configuration.getExecutableCommand();
        const setupEnvVars = this.model.getSetupEnvVariablesAsObject();

        const task = new vscode.Task(
            {
                type: 'clean'
            },
            this.m_workspaceFolder,
            'clean', this.getTaskSource(),
            new vscode.ShellExecution(`${executable} clean`, { cwd: this.m_workspaceFolder.uri.path, env: setupEnvVars }),
            '$gcc'
        );

        if (this.m_configuration.isClearTerminalBeforeAction()) {
            this.clearTerminal();
        }

        const execution = await vscode.tasks.executeTask(task);
        this.showProgressOfTask('clean', execution);

    }

    public async buildSingle() {
        // Get current open file.
        // - Check if there is any file open
        const textEditor = vscode.window.activeTextEditor;
        if (textEditor === undefined) {
            vscode.window.showErrorMessage('Build failed. There is no active text editor.');
        } else {
            let filePath = textEditor.document.uri.fsPath;
            // Get relative path from the workspace
            filePath = path.relative(this.m_workspaceFolder.uri.fsPath, filePath);

            // Check if there are any `..`, as this would indicate we are outside of the workspace
            if (filePath.includes('..')) {
                vscode.window.showErrorMessage('Build failed. Please open a file in the current workspace.');
                return;
            }

            // Build command
            const buildArgs = this.model.getBazelBuildArgs();
            const configArgs = this.model.getBuildConfigArgs();
            const executable = this.m_configuration.getExecutableCommand();
            const setupEnvVars = this.model.getSetupEnvVariablesAsObject();
            const task = new vscode.Task(
                {
                    type: `build ${filePath}`
                },
                this.m_workspaceFolder,
                `build ${filePath}`, this.getTaskSource(),
                new vscode.ShellExecution(`${executable} build --compile_one_dependency ${buildArgs} ${configArgs} ${filePath}\n`, { cwd: this.m_workspaceFolder.uri.path, env: setupEnvVars }),
                '$gcc'
            );

            if (this.m_configuration.isClearTerminalBeforeAction()) {
                this.clearTerminal();
            }
            const execution = await vscode.tasks.executeTask(task);
            this.showProgressOfTask(`build ${filePath}`, execution);
        }
    }

    private getRandomInt(max: number) {
        return Math.floor(Math.random() * Math.floor(max));
    }

    public async run(target: string) {
        if (!this.m_configuration.shouldRunBinariesDirect()) {
            return this.runInBazel(target);
        } else {
            return this.runDirect(target);
        }
    }

    private async runInBazel(target: string) {
        const configArgs = this.model.getRunConfigArgs();
        const executable = this.m_configuration.getExecutableCommand();
        const envVars = this.model.getRunEnvVariablesAsObject();
        const setupEnvVars = this.model.getSetupEnvVariablesAsObject();
        const bazelArgs = this.model.getBazelRunArgs();
        let runArgs = this.model.getRunArgs(target);
        if (runArgs.length > 0) {
            runArgs = '-- ' + runArgs;
        }
        // target is in the form of a relative path: bazel-bin/path/executable
        // bazelTarget is in the form of //path:executable
        const bazelTarget = this.getBazelTarget(target);
        const task = new vscode.Task(
            {
                // Added this so we can run multiple apps at once
                type: `run ${bazelTarget}` + this.getRandomInt(1000000)
            },
            this.m_workspaceFolder,
            `run ${bazelTarget}`, this.getTaskSource(),
            new vscode.ShellExecution(`${executable} run ${bazelArgs} ${configArgs} ${bazelTarget} ${runArgs}\n`, { cwd: this.m_workspaceFolder.uri.path, env: { ...setupEnvVars, ...envVars } })
        );

        if (this.m_configuration.isClearTerminalBeforeAction()) {
            this.clearTerminal();
        }

        const execution = await vscode.tasks.executeTask(task);

        this.showProgressOfTask(`run ${bazelTarget}`, execution);
    }

    private async runDirect(target: string) {
        if (this.m_configuration.isBuildBeforeLaunch()) {
            await this.buildTarget(common.BUILD_RUN_TARGET_STR);
        }

        const targetPath = await this.getBazelTargetBuildPath(target);
        // Program (executable) path with respect to workspace.
        const programPath = path.join(this.m_workspaceFolder.uri.path, targetPath);

        const args = this.model.getRunArgs(target);
        const envVars = this.model.getRunEnvVariablesAsObject();
        const setupEnvVars = this.model.getSetupEnvVariablesAsObject();

        const task = new vscode.Task(
            {
                // Added this so we can run multiple apps at once
                type: `run ${programPath}` + this.getRandomInt(1000000)
            },
            this.m_workspaceFolder,
            `run ${programPath}`, this.getTaskSource(),
            new vscode.ProcessExecution(`${programPath}`, args.split(' '),
                { cwd: this.m_workspaceFolder.uri.path, env: { ...setupEnvVars, ...envVars } })
        );
        if (this.m_configuration.isClearTerminalBeforeAction()) {
            this.clearTerminal();
        }

        const execution = await vscode.tasks.executeTask(task);

        this.showProgressOfTask(`run ${programPath}`, execution);
    }

    public async debug(target: string) {
        if (!this.m_configuration.shouldRunBinariesDirect()) {
            return this.debugInBazel(target);
        } else {
            return this.debugDirect(target);
        }
    }

    public async createLocalDebugScript(target: string):  Promise<void> {
        // Create a task to get the environment variables when we source bazel script
        const executable = this.m_configuration.getExecutableCommand();
        const envVars = this.model.getRunEnvVariables();
        const envSetupCommand = this.m_configuration.getSetupEnvironmentCommand();

        const task = new vscode.Task(
            {
                type: `debug ${target}`
            },
            this.m_workspaceFolder,
            `debug ${target}`, this.getTaskSource(),
            new vscode.ShellExecution(`bash -c "echo '#!/bin/bash\n${envSetupCommand}\n${envVars} ${executable} run --run_under=gdb \\"\\$@\\"\n' > ${this.m_workspaceFolder.uri.path}/.vscode/bazel_debug.sh" && chmod +x ${this.m_workspaceFolder.uri.path}/.vscode/bazel_debug.sh\n`,
                { cwd: this.m_workspaceFolder.uri.path })
        );
        // We don't want to see the task's output.
        task.presentationOptions.reveal = vscode.TaskRevealKind.Silent;
        task.presentationOptions.echo = false;
        task.presentationOptions.panel = vscode.TaskPanelKind.Shared;

        if (this.m_configuration.isClearTerminalBeforeAction()) {
            this.clearTerminal();
        }

        const execution = await vscode.tasks.executeTask(task);
        return new Promise<void>(resolve => {
            const disposable = vscode.tasks.onDidEndTaskProcess(e => {
                if (e.execution === execution) {
                    if (e.exitCode != 0)
                        throw new Error(`Could not run prelaunch task. Exit code: ${e.exitCode}.`);
                    disposable.dispose();
                    resolve();
                }
            });
        });
    }

    private hasFileInWorkspace(fileRelativePath: string): boolean {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const filePath = path.join(folder.uri.fsPath, fileRelativePath);
                if (fs.existsSync(filePath)) {
                    return true;
                }
            }
        }
        return false;
    }

    public refreshLaunchConfigs(target: string) {
        if (target === undefined)
        {
            return;
        }

        // Not a bazel project, return
        if (!this.hasFileInWorkspace('WORKSPACE')) {
            return;
        }

        this.createRunUnderLaunchConfig(target).then(runUnder => {
            this.createDirectLaunchConfig(target).then(direct => {
                const configs = [
                    runUnder, direct
                ];
                const oldConfigs = vscode.workspace
                    .getConfiguration('launch').get<vscode.DebugConfiguration[]>('configurations');

                if (oldConfigs) {
                    for (const c of oldConfigs) {
                        if (c.name !== runUnder.name &&
                            c.name !== direct.name) {
                            configs.push(c);
                        }
                    }
                }
                vscode.workspace
                    .getConfiguration('launch').update('configurations', configs, vscode.ConfigurationTarget.Workspace);
            });
        });
    }

    private async getBazelTargetBuildPath(target: string) {
        const bazelTarget = this.getBazelTarget(target);
        const executable = this.m_configuration.getExecutableCommand();
        const configs = this.model.getRunConfigArgs();
        const cmd = `cquery ${configs} --output=starlark --starlark:expr=target.files_to_run.executable.path`;

        const result = await this.runShellCommand(`${executable} ${cmd} ${bazelTarget}`, false);
        return result.stdout;
    }

    private async createRunUnderLaunchConfig(target: string) {
        const bazelTarget = this.getBazelTarget(target);
        const args = this.model.getRunArgs(target);
        const bazelArgs = this.model.getBazelRunArgs();
        const configArgs = this.model.getRunConfigArgs();
        const workingDirectory = this.m_workspaceFolder.uri.path;
        const targetPath = await this.getBazelTargetBuildPath(target);

        // Program (executable) path with respect to workspace.
        const programPath = path.join(workingDirectory, targetPath);
        // This is a hacky approach to force debug in a container.
        const debugConf: vscode.DebugConfiguration = {
            name: `${bazelTarget}`,
            type: 'cppdbg',
            request: 'launch',
            program: bazelTarget, // This is not used.
            args: args.split(/\s/), // Not used.
            stopAtEntry: false,
            cwd: this.m_workspaceFolder.uri.path,
            sourceFileMap: {
                '/proc/self/cwd': this.m_workspaceFolder.uri.path, // This is important for breakpoints,
            },
            externalConsole: false,
            targetArchitecture: 'x64', // Might we useful to change it based on target.
            // We need this to find the symbols inside bazel with respect to gdb's
            // starting point.
            customLaunchSetupCommands: [
                {
                    'description': '',
                    'text': `-file-exec-and-symbols ${programPath}`,
                    'ignoreFailures': false
                }
            ],
            setupCommands: [
                {
                    description: 'Enable pretty-printing for gdb',
                    text: '-enable-pretty-printing',
                    ignoreFailures: true
                }
            ],
            pipeTransport: {
                'pipeCwd': this.m_workspaceFolder.uri.path,
                'pipeProgram': `${this.m_workspaceFolder.uri.path}/.vscode/bazel_debug.sh`,
                'pipeArgs': [`${bazelArgs} ${configArgs} ${bazelTarget} -- \\$@`],
                'debuggerPath': '.',
                'quoteArgs': false,
            },
            // Couldn't find a way to get the bazel output.
            logging: {
                programOutput: true
            },
            internalConsoleOptions: 'openOnSessionStart'
        };
        if (this.m_configuration.isDebugEngineLogging()) {
            debugConf.logging.engineLogging = true;
        }

        // Debugger does not accept an empty list as arguments
        if (args.length > 0) {
            debugConf.customLaunchSetupCommands.push(
                {
                    'text': `set args ${args}`,
                    'ignoreFailures': false
                });
        }
        return debugConf;
    }

    private async createDirectLaunchConfig(target: string) {
        const workingDirectory = this.m_workspaceFolder.uri.path;
        // Sandbox deploy is finished. Try to execute.
        const args = this.model.getRunArgs(target);

        const targetPath = await this.getBazelTargetBuildPath(target);
        // Program (executable) path with respect to workspace.
        const programPath = path.join(workingDirectory, targetPath);

        const envVars = this.model.getRunEnvVariablesAsArray();
        const setupEnvVars = this.model.getSetupEnvVariablesAsArray();
        // Debug configuration.
        const debugConf: vscode.DebugConfiguration = {
            name: programPath,
            type: 'cppdbg',
            request: 'launch',
            program: programPath,
            stopAtEntry: false,
            cwd: this.m_workspaceFolder.uri.path,
            environment: [...setupEnvVars, ...envVars],
            externalConsole: false,
            MIMode: 'gdb',
            setupCommands: [
                {
                    description: 'Enable pretty-printing for gdb',
                    text: '-enable-pretty-printing',
                    ignoreFailures: true
                }
            ]
        };

        // Debugger does not accept an empty list as arguments
        if (args.length > 0) {
            debugConf.args = args.split(' ');
        }

        return debugConf;
    }

    private async debugWithProgress(target: string, debugConf: vscode.DebugConfiguration) {
        const bazelTarget = this.getBazelTarget(target);

        // Show a notification that we're debugging.
        this.showProgress(`debug ${bazelTarget}`,
            (cancellationToken) => {
                return new Promise((resolve, reject) => {
                    if (this.m_configuration.isBuildBeforeLaunch()) {
                        this.buildTarget(common.BUILD_RUN_TARGET_STR).then(res => {
                            vscode.debug.startDebugging(this.m_workspaceFolder, debugConf);
                        });
                    } else {
                        vscode.debug.startDebugging(this.m_workspaceFolder, debugConf);
                    }

                    cancellationToken.onCancellationRequested(() => {
                        vscode.commands.executeCommand('workbench.action.debug.stop');
                        reject(`debug ${bazelTarget} cancelled.`);
                    });
                });
            });
    }

    private async debugInBazel(target: string) {
        this.createRunUnderLaunchConfig(target).then(debugConf => {
            this.createLocalDebugScript(target).then(res => {
                // Sandbox deploy is finished. Try to execute.
                this.debugWithProgress(target, debugConf);
            }).catch(e => {
                console.log(e);
            });
        });
    }

    private async debugDirect(target: string) {
        this.createDirectLaunchConfig(target).then(debugConf => {
            this.debugWithProgress(target, debugConf);
        });
    }

    public async getPaths(root = '') {
        const all = '/' + path.join('/', root, '...');
        const absoluteRoot = path.join(this.m_workspaceFolder.uri.path, root);

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

    public async getRunPaths(root: string = common.BAZEL_BIN) {
        const execs: vscode.QuickPickItem[] = [];
        const folders: vscode.QuickPickItem[] = [];

        const rootFolder: string = path.join(this.m_workspaceFolder.uri.path, root);
        return fs.promises.readdir(rootFolder).then(
            data => {
                data.forEach((value, index) => {
                    const filepath: string = path.join(rootFolder, value);
                    const relativePath: string = path.join(root, value);
                    if (path.extname(filepath).length === 0 && isExecutable(filepath) && value.charAt(0) !== '.') {
                        execs.push({ label: `$(play) ${relativePath}` });
                    }
                    else if (fs.lstatSync(path.join(rootFolder, value)).isDirectory()) {
                        folders.push({ label: `$(folder) ${relativePath}` });
                    }
                });
                return execs.concat(folders);
            }
        );
    }

    public getWorkspacePath(): string {
        return this.m_workspaceFolder.uri.path;
    }

    public refreshRunTargets(): Promise<void> {
        if (this.m_isRefreshingRunTargets) {
            vscode.window.showWarningMessage('Run targets are still being refreshed...');
            return Promise.resolve();
        }
        else {
            const executable = this.m_configuration.getExecutableCommand();
            const cmd = this.m_configuration.getGenerateRunTargetsCommand();

            this.m_isRefreshingRunTargets = true;
            return this.runShellCommand(`${executable} ${cmd}`, false).then(data => {
                const all_outputs = data.stdout.split('\n');
                const targets: vscode.QuickPickItem[] = [];
                all_outputs.forEach(element => {
                    if (element.length >= 2 && element.substring(0, 2).includes('//')) {
                        const target_names = element.split(':');
                        const target_name = target_names.pop();
                        const target_path = target_names[0];
                        if (target_name !== undefined) {
                            targets.push({
                                label: target_name,
                                detail: path.join(common.BAZEL_BIN, ...target_path.split('/'), target_name)
                            });
                        }
                    }
                });
                // Sort targets
                targets.sort((a: vscode.QuickPickItem, b: vscode.QuickPickItem) => { return a.label < b.label ? -1 : 1; });
                this.m_runTargets = targets;
                this.workspaceState.update(BazelController.RunTargets, this.m_runTargets);
                this.m_isRefreshingRunTargets = false;

                return Promise.resolve();
            });
        }
    }

    public async getRunTargets(): Promise<vscode.QuickPickItem[]> {
        if (this.m_runTargets.length == 0) {
            return this.refreshRunTargets().then(
                () => { return this.m_runTargets; }
            );
        } else {
            return this.m_runTargets;
        }
    }

    /// type should be 'build', 'run', or 'test'
    public async getConfigs(type: string): Promise<string[]> {
        // Check if bazel-complete.bash exists
        const bash_complete_script = path.join(this.m_workspaceFolder.uri.path, '3rdparty', 'bazel', 'bazel', 'bazel-complete.bash');
        const does_path_exist = fs.existsSync(bash_complete_script);
        if (!does_path_exist) {
            vscode.window.showWarningMessage(`Cannot find ${bash_complete_script} to receive available configurations.`);
            return [];
        }
        else {
            // Get configs from bazel commands on shell for both run and build.
            // Combine them, convert to set to remove duplicates and back to list.
            const configs = await this.runShellCommand(`bash -c 'source ${bash_complete_script} && echo $(_bazel__expand_config . ${type})'`, false).then(data => { return data.stdout.split(' '); });
            const config_set = new Set(configs);
            return Array.from(config_set.values());
        }
    }

    private showProgressOfTask(title: string, execution: vscode.TaskExecution) {
        return this.showProgress(title, (cancellationToken) => {
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

    private showProgress(title: string, longMethod: (token: vscode.CancellationToken) => Promise<any>): Promise<any> {

        return new Promise<string>((resolve, reject) => {

            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Blue Bazel: ${title}`,
                    cancellable: true
                },
                async (progress, cancellationToken) => {
                    progress.report({ increment: undefined, message: '...' });

                    try {
                        const result = await longMethod(cancellationToken);
                        progress.report({ increment: undefined, message: 'Finished.' });
                        resolve(result);
                    } catch (error) {
                        progress.report({ increment: undefined, message: 'Cancelled.' });
                        reject(error);
                    }
                }
            );
        });
    }

    private runShellCommand(cmd: string, showOutput: boolean): Promise<{ stdout: string }> {

        this.m_outputChannel.clear();
        this.m_outputChannel.appendLine(`Running shell command: ${cmd}`);

        if (showOutput) {
            this.m_outputChannel.show();
        }
        return this.showProgress(cmd, (cancellationToken): Promise<{ stdout: string }> => {
            return new Promise<{ stdout: string }>((resolve, reject) => {
                const setupEnvVars = this.model.getSetupEnvVariablesAsObject();
                const execOptions: child.ExecOptions = {
                    cwd: this.m_workspaceFolder.uri.path,
                    shell: 'bash',
                    maxBuffer: Number.MAX_SAFE_INTEGER,
                    windowsHide: false,
                    env: {...setupEnvVars, ...process.env}
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

                proc.stdout?.on('data', (data) => { this.m_outputChannel.appendLine(data); });
                proc.stderr?.on('data', (data) => { this.m_outputChannel.appendLine(data); });

                if (cancellationToken) {
                    cancellationToken.onCancellationRequested(() => {
                        proc.kill();
                        reject(new Error(`${cmd} cancelled.`));
                    });
                }

            });
        });
    }

    private substituteKeywords(input: string): string {
        let output = input;
        // First replace keywords
        const regexp = /\$\{([^\s]*)\}/g;
        let match;
        do {
            match = regexp.exec(input);
            if (match) {
                output = output.replace(match[0], this.getCurrentValue(match[1]));
            }
        } while (match);
        return output;
    }

    private async substituteCommands(input: string): Promise<string> {
        // Execute commands
        let output = input;
        const regexp = /<([^\s]*)>/g;
        let match;
        do {
            match = regexp.exec(input);
            if (match) {
                const currentCommand = await this.getCurrentCommand(match[1]);
                console.log(`Current command: ${currentCommand}`);
                const evalRes = await this.runShellCommand(currentCommand, this.m_configuration.isShowShellCommandOutput());

                output = output.replace(match[0], evalRes.stdout);
            }
        } while (match);
        return output;
    }

    public async runCustomTask(command: string): Promise<void> {
        let completeCommand = this.substituteKeywords(command);
        completeCommand = await this.substituteExtCommands(completeCommand);
        completeCommand = await this.substituteCommands(completeCommand);
        const setupEnvVars = this.model.getSetupEnvVariablesAsObject();

        const task = new vscode.Task(
            {
                type: `${completeCommand}`
            },
            this.m_workspaceFolder,
            completeCommand, this.getTaskSource(),
            new vscode.ShellExecution(`${completeCommand}\n`, { cwd: this.m_workspaceFolder.uri.path, env: setupEnvVars}),
            '$gcc'
        );

        if (this.m_configuration.isClearTerminalBeforeAction()) {
            this.clearTerminal();
        }


        vscode.tasks.executeTask(task);
    }

    private async substituteExtCommands(input: string) {
        // Execute commands
        let output = input;
        const regexp = /\[([^\s]*)\(([^\s]*)\)\]/g;
        let match;
        do {
            match = regexp.exec(input);
            if (match) {
                const extCommand = match[1];
                const extArgs = match[2];
                let evalRes = '';
                if (extCommand === common.EXTENSION_COMMANDS.pick) {
                    evalRes = await this.extPick(extArgs);
                } else if (extCommand === common.EXTENSION_COMMANDS.input) {
                    await vscode.window.showInputBox(
                        {value: extArgs}
                    ).then((val) => {
                        if (val !== undefined) {
                            evalRes = val;
                        }
                    });
                }
                output = output.replace(match[0], evalRes);
            }
        } while (match);
        return output;
    }

    private async getCurrentCommand(keyword: string): Promise<string> {
        const commands = this.m_configuration.getShellCommands();
        let res = '';

        for (const element of commands) {
            if (keyword === element.name) {
                res = this.substituteKeywords(element.command);
                res = await this.substituteExtCommands(res);
                res = await this.substituteCommands(res);
            }
        }
        return res;
    }

    private getBazelTarget(target: string): string {
        const result = target;
        const resultSplitted = result.split('/');
        resultSplitted.shift(); // Removes bazel-bin
        const targetName = resultSplitted[resultSplitted.length - 1];
        return '//' + resultSplitted.slice(0, resultSplitted.length - 1).join('/') + ':' + targetName;
    }

    private getCurrentValue(keyword: string): string {
        if (keyword === common.CONFIG_KEYWORDS.runArgs) {
            return this.model.getRunArgs(this.model.getTarget(common.TargetType.RUN).value);
        } else if (keyword === common.CONFIG_KEYWORDS.testArgs) {
            return this.model.getTestArgs(this.model.getTarget(common.TargetType.TEST).value);
        } else if (keyword === common.CONFIG_KEYWORDS.runTarget) {
            const result = this.model.getTarget(common.TargetType.RUN).value;
            const resultSplitted = result.split('/');
            resultSplitted.shift(); // Removes bazel-bin
            const targetName = resultSplitted[resultSplitted.length - 1];
            return '//' + resultSplitted.slice(0, resultSplitted.length - 1).join('/') + ':' + targetName;
        } else if (keyword === common.CONFIG_KEYWORDS.testTarget) {
            const result = this.model.getTarget(common.TargetType.TEST).value;
            const resultSplitted = result.split('/');
            resultSplitted.shift(); // Removes bazel-bin
            const targetName = resultSplitted[resultSplitted.length - 1];
            return '//' + resultSplitted.slice(0, resultSplitted.length - 1).join('/') + ':' + targetName;
        } else if (keyword === common.CONFIG_KEYWORDS.buildConfigs) {
            return this.model.getBuildConfigArgs();
        } else if (keyword === common.CONFIG_KEYWORDS.runConfigs) {
            return this.model.getRunConfigArgs();
        } else if (keyword === common.CONFIG_KEYWORDS.testConfigs) {
            return this.model.getTestConfigArgs();
        } else if (keyword === common.CONFIG_KEYWORDS.bazelBuildArgs) {
            return this.model.getBazelBuildArgs();
        } else if (keyword === common.CONFIG_KEYWORDS.bazelRunArgs) {
            return this.model.getBazelRunArgs();
        } else if (keyword === common.CONFIG_KEYWORDS.bazelTestArgs) {
            return this.model.getBazelTestArgs();
        } else if (keyword === common.CONFIG_KEYWORDS.buildEnvVars) {
            return this.model.getBuildEnvVars().join(' ');
        } else if (keyword === common.CONFIG_KEYWORDS.runEnvVars) {
            return this.model.getRunEnvVars().join(' ');
        } else if (keyword === common.CONFIG_KEYWORDS.testEnvVars) {
            return this.model.getTestEnvVars().join(' ');
        } else if (keyword === common.CONFIG_KEYWORDS.buildTarget) {
            return this.model.getTarget(common.TargetType.BUILD).value;
        } else if (keyword === common.CONFIG_KEYWORDS.executable) {
            return this.m_configuration.getExecutableCommand();
        } else {
            return '${' + keyword + '}';
        }
    }

    private async extPick(input: string): Promise<string> {
        // Evaluate the inner command of the pick
        const output = await this.substituteCommands(input);
        console.log(output);
        // Make a list of the output
        const outputList = [];
        for (const element of output.split('\n')) {
            const elementTrimmed = element.trim();
            if (elementTrimmed.length > 0) outputList.push(elementTrimmed);
        }
        console.log(outputList);

        let res = '';
        await vscode.window.showQuickPick(outputList, { 'ignoreFocusOut': true }).then(data => {
            if (data !== undefined)
                res = data;
        });
        return res;
    }

    private async clearTerminal() {
        await vscode.commands.executeCommand('workbench.action.terminal.clear');
    }
}

