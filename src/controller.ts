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
import * as fs from 'fs';
import * as common from './common';
import { ConfigurationManager } from './services/configuration-manager';
import { BazelModel } from './model';
// eslint-disable-next-line
// @ts-ignore
import { sync as isExecutable } from 'executable';
import { showProgress } from './ui/progress';
import { ShellService } from './services/shell-service';
import { WorkspaceService } from './services/workspace-service';
import { clearTerminal } from './ui/terminal';
import { TaskService } from './services/task-service';
import { EnvVarsUtils } from './services/env-vars-utils';
import { BazelService } from './services/bazel-service';
import { EnvironmentService } from './services/environment-service';

interface RunTarget {
    label: string,
    value: string
}

export class BazelController {

    static TaskSource = 'Blue Bazel';
    static RunTargets = 'BazelRunTargets';

    private m_runTargets: vscode.QuickPickItem[] = [];
    private m_isRefreshingRunTargets = false;

    private m_outputChannel: vscode.OutputChannel;
    private shellService: ShellService;
    private taskService: TaskService;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly workspaceState: vscode.Memento,
        private readonly configurationManager: ConfigurationManager,
        private readonly model: BazelModel,
        private readonly bazelService: BazelService,
        private readonly environmentService: EnvironmentService
    ) {
        this.m_outputChannel = vscode.window.createOutputChannel(configurationManager.getExtensionDisplayName());

        // Load the run targets
        const targets: vscode.QuickPickItem[] | undefined = this.workspaceState.get<vscode.QuickPickItem[]>(BazelController.RunTargets);
        if (targets !== undefined) {
            this.m_runTargets = targets;
        }

        this.updateSetupEnvVars();

        this.shellService = new ShellService(WorkspaceService.getInstance().getWorkspaceFolder(), this.m_outputChannel, EnvVarsUtils.listToObject(this.model.getSetupEnvVars()));

        this.taskService = new TaskService(context,
            WorkspaceService.getInstance().getWorkspaceFolder(),
            EnvVarsUtils.listToObject(this.model.getSetupEnvVars())
        );
    }

    private updateSetupEnvVars() {
        this.model.update(common.WORKSPACE_KEYS.setupEnvVars, '');
        this.environmentService.fetchSetupEnvironment().then((envArray: string[]) => {
            this.model.update(common.WORKSPACE_KEYS.setupEnvVars, envArray);
        });
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
        const buildArgs = this.model.getBazelBuildArgs();
        const configArgs = this.model.getBuildConfigArgs();
        const executable = this.configurationManager.getExecutableCommand();

        await this.taskService.runTask(
            `build ${filePath}`, // task type
            `build ${filePath}`, // task name
            `${executable} build --compile_one_dependency ${buildArgs} ${configArgs} ${filePath}`,
            this.configurationManager.isClearTerminalBeforeAction()
        );
    }

    private getRandomInt(max: number) {
        return Math.floor(Math.random() * Math.floor(max));
    }

    public getTestCommand(target: string): string | undefined {
        if (!target) {
            return undefined;
        }
        const configArgs = this.model.getTestConfigArgs();
        const executable = this.configurationManager.getExecutableCommand();
        const bazelArgs = this.model.getBazelTestArgs();
        const envVars = this.model.getTestEnvVariables();
        const bazelTarget = target;
        const testArgs = this.model.getTestArgs(target);
        return `${executable} test ${bazelArgs} ${configArgs} ${envVars} ${bazelTarget} ${testArgs}\n`;
    }

    public async test(target: string) {
        const testCommand = this.getTestCommand(target);
        if (!testCommand) {
            vscode.window.showErrorMessage('Test failed. Could not get test target.');
            return;
        }

        const taskType = `test ${target}`;
        const taskLabel = `test ${target}`;

        return this.taskService.runTask(taskType, taskLabel, testCommand, this.configurationManager.isClearTerminalBeforeAction());
    }


    public async debug(target: string) {
        if (!this.configurationManager.shouldRunBinariesDirect()) {
            return this.debugInBazel(target);
        } else {
            return this.debugDirect(target);
        }
    }

    public async createLocalDebugScript(target: string):  Promise<void> {
        // Create a task to get the environment variables when we source bazel script
        const executable = this.configurationManager.getExecutableCommand();
        const envVars = this.model.getRunEnvVariables();
        const envSetupCommand = this.configurationManager.getSetupEnvironmentCommand();

        const task = new vscode.Task(
            {
                type: `debug ${target}`
            },
            WorkspaceService.getInstance().getWorkspaceFolder(),
            `debug ${target}`, 'Blue Bazel' + this.getRandomInt(10000),
            new vscode.ShellExecution(`bash -c "echo '#!/bin/bash\n${envSetupCommand}\n${envVars} ${executable} run --run_under=gdb \\"\\$@\\"\n' > ${WorkspaceService.getInstance().getWorkspaceFolder().uri.path}/.vscode/bazel_debug.sh" && chmod +x ${WorkspaceService.getInstance().getWorkspaceFolder().uri.path}/.vscode/bazel_debug.sh\n`,
                { cwd: WorkspaceService.getInstance().getWorkspaceFolder().uri.path })
        );
        // We don't want to see the task's output.
        task.presentationOptions.reveal = vscode.TaskRevealKind.Silent;
        task.presentationOptions.echo = false;
        task.presentationOptions.panel = vscode.TaskPanelKind.Shared;

        if (this.configurationManager.isClearTerminalBeforeAction()) {
            clearTerminal();
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

    public refreshLaunchConfigs(target: string) {
        if (target === undefined)
        {
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
        const executable = this.configurationManager.getExecutableCommand();
        const configs = this.model.getRunConfigArgs();
        const cmd = `cquery ${configs} --output=starlark --starlark:expr=target.files_to_run.executable.path`;

        const result = await this.shellService.runShellCommand(`${executable} ${cmd} ${bazelTarget}`, false);
        return result.stdout;
    }

    private async createRunUnderLaunchConfig(target: string) {
        const bazelTarget = this.getBazelTarget(target);
        const args = this.model.getRunArgs(target);
        const bazelArgs = this.model.getBazelRunArgs();
        const configArgs = this.model.getRunConfigArgs();
        const workingDirectory = WorkspaceService.getInstance().getWorkspaceFolder().uri.path;
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
            cwd: WorkspaceService.getInstance().getWorkspaceFolder().uri.path,
            sourceFileMap: {
                '/proc/self/cwd': WorkspaceService.getInstance().getWorkspaceFolder().uri.path, // This is important for breakpoints,
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
                'pipeCwd': WorkspaceService.getInstance().getWorkspaceFolder().uri.path,
                'pipeProgram': `${WorkspaceService.getInstance().getWorkspaceFolder().uri.path}/.vscode/bazel_debug.sh`,
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
        if (this.configurationManager.isDebugEngineLogging()) {
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
        const workingDirectory = WorkspaceService.getInstance().getWorkspaceFolder().uri.path;
        // Sandbox deploy is finished. Try to execute.
        const args = this.model.getRunArgs(target);

        const targetPath = await this.getBazelTargetBuildPath(target);
        // Program (executable) path with respect to workspace.
        const programPath = path.join(workingDirectory, targetPath);

        const envVars = EnvVarsUtils.listToArray(this.model.getRunEnvVars());
        const setupEnvVars = EnvVarsUtils.listToArray(this.model.getSetupEnvVars());
        // Debug configuration.
        const debugConf: vscode.DebugConfiguration = {
            name: programPath,
            type: 'cppdbg',
            request: 'launch',
            program: programPath,
            stopAtEntry: false,
            cwd: WorkspaceService.getInstance().getWorkspaceFolder().uri.path,
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
        showProgress(`debug ${bazelTarget}`,
            (cancellationToken) => {
                return new Promise((resolve, reject) => {
                    if (this.configurationManager.isBuildBeforeLaunch()) {
                        this.buildTarget(common.BUILD_RUN_TARGET_STR).then(res => {
                            vscode.debug.startDebugging(WorkspaceService.getInstance().getWorkspaceFolder(), debugConf);
                        });
                    } else {
                        vscode.debug.startDebugging(WorkspaceService.getInstance().getWorkspaceFolder(), debugConf);
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
        const absoluteRoot = path.join(WorkspaceService.getInstance().getWorkspaceFolder().uri.path, root);

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

    public refreshRunTargets(): Promise<void> {
        if (this.m_isRefreshingRunTargets) {
            vscode.window.showWarningMessage('Run targets are still being refreshed...');
            return Promise.resolve();
        }
        else {

            this.m_isRefreshingRunTargets = true;
            return this.bazelService.fetchRunTargets().then((runTargets: { label: string, detail: string }[]) => {
                const items = runTargets.map(value => ({
                    label: value.label,
                    detail: value.detail
                }));

                this.workspaceState.update(BazelController.RunTargets, items);
                this.m_runTargets = items;
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

    public async getTestTargets(target: string): Promise<vscode.QuickPickItem[]> {
        const testTarget = this.getBazelTarget(target);
        const executable = this.configurationManager.getExecutableCommand();
        const testPath = testTarget.replace(new RegExp(/:.*/g), '/...');
        const command = `${executable} query 'tests(${testPath})'`;
        const result = await this.shellService.runShellCommand(command, false).then((value) => {
            return new Promise<vscode.QuickPickItem[]>(resolve => {
                const test = testTarget.split(':').slice(-1)[0];
                resolve(value.stdout.split('\n').map(item => ({ label: test + ':' + item.split(':').slice(-1)[0], detail: item })));
            });
        });
        return result;
    }

    /// type should be 'build', 'run', or 'test'
    public async getConfigs(type: string): Promise<string[]> {
        // Check if bazel-complete.bash exists
        const bash_complete_script = path.join(WorkspaceService.getInstance().getWorkspaceFolder().uri.path, '3rdparty', 'bazel', 'bazel', 'bazel-complete.bash');
        const does_path_exist = fs.existsSync(bash_complete_script);
        if (!does_path_exist) {
            vscode.window.showWarningMessage(`Cannot find ${bash_complete_script} to receive available configurations.`);
            return [];
        }
        else {
            // Get configs from bazel commands on shell for both run and build.
            // Combine them, convert to set to remove duplicates and back to list.
            const configs = await this.shellService.runShellCommand(`bash -c 'source ${bash_complete_script} && echo $(_bazel__expand_config . ${type})'`, false).then(data => { return data.stdout.split(' '); });
            const config_set = new Set(configs);
            return Array.from(config_set.values());
        }
    }



    private getBazelTarget(target: string): string {
        const result = target;
        const resultSplitted = result.split('/');
        resultSplitted.shift(); // Removes bazel-bin
        const targetName = resultSplitted[resultSplitted.length - 1];
        return '//' + resultSplitted.slice(0, resultSplitted.length - 1).join('/') + ':' + targetName;
    }
}

