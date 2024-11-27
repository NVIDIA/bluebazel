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

import { BazelTargetController } from './bazel-target-controller';
import { BuildController } from './build-controller';
import { LanguageRegistry } from '../../languages/language-registry';
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetState, BazelTargetStateManager } from '../../models/bazel-target-state-manager';
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { getAvailablePort, waitForPort } from '../../services/network-utils';
import { cleanAndFormat } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import { WorkspaceService } from '../../services/workspace-service';
import { showProgress } from '../../ui/progress';
import * as path from 'path';
import * as vscode from 'vscode';


export class DebugController implements BazelTargetController {

    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly bazelService: BazelService,
        private readonly buildController: BuildController,
        private readonly bazelTargetStateManager: BazelTargetStateManager
    ) {}

    private async createAttachConfig(target: BazelTarget, port: number): Promise<vscode.DebugConfiguration> {
        const plugin = LanguageRegistry.getPlugin(target.language);
        return plugin.createDebugAttachConfig(target, port);
    }

    public async execute(target: BazelTarget): Promise<void> {
        try {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Debugging);

            const shouldRunDirect = this.configurationManager.shouldRunBinariesDirect() && target.action === 'run';
            if (!shouldRunDirect) {
                await this.debugInBazel(target);
            } else {
                await this.debugDirect(target);
            }
        } catch (error) {
            return Promise.reject(error);
        } finally {
            // End debug
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Idle);
        }
    }

    public async getExecuteCommand(target: BazelTarget): Promise<string | undefined> {
        if (!target) {
            return undefined;
        }
        const port = await getAvailablePort();
        const shouldRunDirect = this.configurationManager.shouldRunBinariesDirect() && target.action === 'run';
        if (!shouldRunDirect) {
            return this.getDebugInBazelCommand(target, port);
        } else {
            return this.getDebugDirectCommand(target, port);
        }
    }

    private getDebugInBazelCommand(target: BazelTarget, port: number): string {
        const configArgs = target.getConfigArgs();
        const executable = this.configurationManager.getExecutableCommand();
        const bazelArgs = target.getBazelArgs();
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.buildPath);
        let runArgs = target.getRunArgs().toString();
        if (runArgs.length > 0) {
            runArgs = '-- ' + runArgs;
        }

        const envVarsList = target.getEnvVars().toStringArray();
        const extraDebugEnvVars = DebugController.getDebugEnvVars(target);
        envVarsList.push(...extraDebugEnvVars);

        // Remove extra whitespaces
        const command = cleanAndFormat(
            executable,
            target.action,
            bazelArgs.toString(),
            DebugController.getRunUnderArg(target, port),
            configArgs.toString(),
            target.action === 'test' ? EnvVarsUtils.toTestEnvVars(envVarsList) : '',
            bazelTarget,
            runArgs
        );

        return `${command}\n`;
    }

    private async getDebugDirectCommand(target: BazelTarget, port: number): Promise<string | undefined> {
        if (!target) {
            return undefined;
        }

        const targetPath = await this.bazelService.getBazelTargetBuildPath(target);
        // Program (executable) path with respect to workspace.
        const programPath = path.join(WorkspaceService.getInstance().getWorkspaceFolder().uri.path, targetPath);
        const runArgs = target.getRunArgs().toString();
        return `${DebugController.getDebugServerCommand(target, port)} ${programPath} ${runArgs}`;
    }

    private async startDebugServer(target: BazelTarget, port: number, command: string, cancellationToken?: vscode.CancellationToken): Promise<vscode.TaskExecution | void> {

        const envVarsList = target.getEnvVars().toStringArray();

        const extraDebugEnvVars = DebugController.getDebugEnvVars(target);
        envVarsList.push(...extraDebugEnvVars);

        const envVars = EnvVarsUtils.listToObject(envVarsList);
        // target is in the form of a relative path: bazel-bin/path/executable
        // bazelTarget is in the form of //path:executable
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.buildPath);

        return this.taskService.runTask(
            `debug ${target.action} ${bazelTarget}`,
            command,
            this.configurationManager.isClearTerminalBeforeAction(),
            cancellationToken,
            target.id,
            envVars, 'shell', 'onDidStartTask');

    }

    private async debugInBazel(target: BazelTarget) {
        // Start a debug server
        return showProgress(`Debugging ${target.action} ${target.bazelPath}`, async (cancellationToken) => {
            // Find an open port
            const port = await getAvailablePort(cancellationToken);
            // Create a debug attach config
            const config = await this.createAttachConfig(target, port);

            // Get the command to launch the debug server (including the target)
            const runCommand = this.getDebugInBazelCommand(target, port);

            // Launch a debug server and await until the task execution starts
            const serverExec = await this.startDebugServer(target, port, runCommand, cancellationToken);

            // Listen for early cancellation of the debug server
            const waitForPortCancellation = new vscode.CancellationTokenSource();
            const disposable = vscode.tasks.onDidEndTask(e => {
                if (e.execution === serverExec) {
                    disposable.dispose();
                    waitForPortCancellation.cancel();
                }
            });

            // Wait for the port to open up by polling (the loop cancels when the server does)
            await waitForPort(port, waitForPortCancellation.token);

            // Start debugging
            const started = await vscode.debug.startDebugging(
                WorkspaceService.getInstance().getWorkspaceFolder(),
                config
            );

            // Get the debug session id for terminating the server
            let debugSessionId = '';
            if (started) {
                const session = vscode.debug.activeDebugSession;
                if (session && session.name === config.name) {
                    debugSessionId = session.id;
                }
            }

            // Kill the server when the debugging is disconnected
            const disp = vscode.debug.onDidTerminateDebugSession((session) => {
                if (session.id === debugSessionId) {
                    disp.dispose(); // Clean up the event listener
                    serverExec?.terminate();
                }
            });
        });
    }

    private async debugDirect(target: BazelTarget) {
        // Debug direct uses a launch config rather than attach config
        if (this.configurationManager.shouldBuildBeforeLaunch()) {
            await this.buildController.execute(target);
        }
        return showProgress(`Debugging ${target.action} ${target.buildPath}`, async (cancellationToken) => {
            const config = await LanguageRegistry.getPlugin(target.language).createDebugDirectLaunchConfig(target, cancellationToken);
            await vscode.debug.startDebugging(WorkspaceService.getInstance().getWorkspaceFolder(), config);
        });
    }

    private static getRunUnderArg(target: BazelTarget, port: number): string {
        return `--run_under="${DebugController.getDebugServerCommand(target, port)}"`;
    }

    private static getDebugEnvVars(target: BazelTarget): string[] {
        return LanguageRegistry.getPlugin(target.language).getDebugEnvVars(target);
    }

    private static getDebugServerCommand(target: BazelTarget, port: number): string {
        return LanguageRegistry.getPlugin(target.language).getDebugRunUnderCommand(port);
    }

}