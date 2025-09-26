////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2025 NVIDIA Corporation
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
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetState, BazelTargetStateManager } from '../../models/bazel-target-state-manager';
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { cleanAndFormat, toGerund } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import { WorkspaceService } from '../../services/workspace-service';
import { showProgress } from '../../ui/progress';
import * as path from 'path';
import * as vscode from 'vscode';


export class RunController implements BazelTargetController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly bazelService: BazelService,
        private readonly buildController: BuildController,
        private readonly bazelTargetStateManager: BazelTargetStateManager
    ) { }

    public async execute(target: BazelTarget): Promise<void> {
        try {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Executing);
            if (!this.configurationManager.shouldRunBinariesDirect()) {
                await this.runInBazel(target);
            } else {
                await this.runDirect(target);
            }
        } catch (error) {
            return Promise.reject(error);
        } finally {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Idle);
        }
    }

    private async runInBazel(target: BazelTarget) {

        // target is in the form of a relative path: bazel-bin/path/executable
        // bazelTarget is in the form of //path:executable
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.buildPath);

        return showProgress(`${toGerund(target.action)} ${bazelTarget}`, async (cancellationToken) => {
            const envVars = EnvVarsUtils.listToObject(target.getEnvVars().toStringArray());

            const runCommand = this.getRunInBazelCommand(target);
            if (!runCommand) {
                vscode.window.showErrorMessage('Run failed. Could not get run target.');
                return;
            }

            return this.taskService.runTask(
                `${target.action} ${bazelTarget}`,
                runCommand,
                this.configurationManager.isClearTerminalBeforeAction(),
                cancellationToken,
                target.id,
                envVars);
        });
    }

    private async runDirect(target: BazelTarget) {
        if (this.configurationManager.shouldBuildBeforeLaunch()) {
            await this.buildController.execute(target);
        }

        return showProgress(`${toGerund(target.action)} ${target.buildPath}`, async (cancellationToken) => {
            const targetPath = target.buildPath;//await this.bazelService.getBazelTargetBuildPath(target);
            // Program (executable) path with respect to workspace.
            const programPath = path.join(WorkspaceService.getInstance().getWorkspaceFolder().uri.path, targetPath);

            const args = target.getRunArgs().toString();
            const envVars = EnvVarsUtils.listToObject(target.getEnvVars().toStringArray());

            return this.taskService.runTask(`${target.action} ${programPath}`, `${programPath} ${args}`,
                this.configurationManager.isClearTerminalBeforeAction(), cancellationToken,
                target.id, envVars, 'process');
        });
    }

    public async getExecuteCommand(target: BazelTarget): Promise<string | undefined> {
        if (!target) {
            return undefined;
        }
        if (!this.configurationManager.shouldRunBinariesDirect()) {
            return this.getRunInBazelCommand(target);
        } else {
            return this.getRunDirectCommand(target);
        }
    }

    private getRunInBazelCommand(target: BazelTarget): string | undefined {
        if (!target) {
            return undefined;
        }
        const configArgs = target.getConfigArgs();
        const executable = this.configurationManager.getExecutableCommand();
        const bazelArgs = target.getBazelArgs();
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.buildPath);
        let runArgs = target.getRunArgs().toString();
        if (runArgs.length > 0) {
            runArgs = '-- ' + runArgs;
        }

        // Remove extra whitespaces
        const command = cleanAndFormat(
            executable,
            'run',
            bazelArgs.toString(),
            configArgs.toString(),
            bazelTarget,
            runArgs
        );

        return `${command}\n`;
    }

    private async getRunDirectCommand(target: BazelTarget): Promise<string | undefined> {
        if (!target) {
            return undefined;
        }

        const targetPath = target.buildPath;//await this.bazelService.getBazelTargetBuildPath(target);
        // Program (executable) path with respect to workspace.
        const programPath = path.join(WorkspaceService.getInstance().getWorkspaceFolder().uri.path, targetPath);
        const runArgs = target.getRunArgs().toString();
        return `${programPath} ${runArgs}`;
    }
}