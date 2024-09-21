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
import { BazelEnvironment } from '../../models/bazel-environment';
import { BazelTarget } from '../../models/bazel-target';
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { Console } from '../../services/console';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { LaunchConfigService } from '../../services/launch-config-service';
import { TaskService } from '../../services/task-service';
import { WorkspaceService } from '../../services/workspace-service';
import { clearTerminal } from '../../ui/terminal';
import * as vscode from 'vscode';


export class DebugController implements BazelTargetController {
    private debugConfigService: LaunchConfigService;

    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        bazelService: BazelService,
        private readonly buildController: BuildController,
        bazelEnvironment: BazelEnvironment
    ) {
        this.debugConfigService = new LaunchConfigService(context,
            bazelService,
            EnvVarsUtils.listToObject(bazelEnvironment.getEnvVars()));
    }

    public async execute(target: BazelTarget): Promise<void> {
        if (!this.configurationManager.shouldRunBinariesDirect()) {
            return this.debugInBazel(target);
        } else {
            return this.debugDirect(target);
        }
    }

    public async getExecuteCommand(target: BazelTarget): Promise<string | undefined> {
        throw Error(`Unsupported operation for debug controller to get execute command for target ${target.detail}`);
    }

    private async debugInBazel(target: BazelTarget) {
        this.debugConfigService.createRunUnderLaunchConfig(target).then(debugConf => {
            this.createLocalDebugScript(target).then(() => {
                // Sandbox deploy is finished. Try to execute.
                this.debug(target, debugConf);
            }).catch(e => {
                Console.error(e);
            });
        });
    }

    private async debugDirect(target: BazelTarget) {
        this.debugConfigService.createDirectLaunchConfig(target).then(debugConf => {
            this.debug(target, debugConf);
        });
    }

    private async debug(target: BazelTarget, debugConf: vscode.DebugConfiguration) {
        if (this.configurationManager.isBuildBeforeLaunch()) {
            this.buildController.execute(target).then(() => {
                vscode.debug.startDebugging(WorkspaceService.getInstance().getWorkspaceFolder(), debugConf);
            });
        } else {
            vscode.debug.startDebugging(WorkspaceService.getInstance().getWorkspaceFolder(), debugConf);
        }
    }

    private async createLocalDebugScript(target: BazelTarget): Promise<void> {
        // Create a task to get the environment variables when we source bazel script
        const executable = this.configurationManager.getExecutableCommand();
        const envVars = EnvVarsUtils.toRunEnvVars(target.getEnvVars().toStringArray());
        const envSetupCommand = this.configurationManager.getSetupEnvironmentCommand();

        const task = new vscode.Task(
            {
                type: `debug ${target}`
            },
            WorkspaceService.getInstance().getWorkspaceFolder(),
            `debug ${target}`,
            TaskService.generateUniqueTaskSource(this.context),
            new vscode.ShellExecution(`bash -c "echo '#!/bin/bash\nset -x\n${envSetupCommand}\n${envVars} ${executable} \\"\\$@\\"\n' > ${WorkspaceService.getInstance().getWorkspaceFolder().uri.path}/.vscode/bazel_debug.sh" && chmod +x ${WorkspaceService.getInstance().getWorkspaceFolder().uri.path}/.vscode/bazel_debug.sh\n`,
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

    public async pickTarget(target?: BazelTarget): Promise<BazelTarget | undefined> {
        throw Error(`Unsupported operation for debug controller to pick target ${target? target.detail : ''}`);
    }
}