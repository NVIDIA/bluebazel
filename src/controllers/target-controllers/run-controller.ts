/////////////////////////////////////////////////////////////////////////////////////////
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
/////////////////////////////////////////////////////////////////////////////////////////

import * as vscode from 'vscode';
import * as path from 'path';
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetController } from './bazel-target-controller';
import { ConfigurationManager } from '../../services/configuration-manager';
import { TaskService } from '../../services/task-service';
import { BUILD_RUN_TARGET_STR } from '../../common';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { WorkspaceService } from '../../services/workspace-service';
import { BazelService } from '../../services/bazel-service';

export class RunController implements BazelTargetController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly bazelService: BazelService
    ) { }

    public async execute(target: BazelTarget): Promise<any> {
        if (!this.configurationManager.shouldRunBinariesDirect()) {
            return this.runInBazel(target);
        } else {
            return this.runDirect(target);
        }
    }

    private getBazelTargetName(target: string): string {
        const result = target;
        const resultSplitted = result.split('/');
        resultSplitted.shift(); // Removes bazel-bin
        const targetName = resultSplitted[resultSplitted.length - 1];
        return '//' + resultSplitted.slice(0, resultSplitted.length - 1).join('/') + ':' + targetName;
    }

    private async runInBazel(target: BazelTarget) {

        const envVars = EnvVarsUtils.listToObject(target.getEnvVars().toStringArray());
        // target is in the form of a relative path: bazel-bin/path/executable
        // bazelTarget is in the form of //path:executable
        const bazelTarget = this.getBazelTargetName(target.detail);

        const runCommand = this.getRunInBazelCommand(target);
        if (!runCommand) {
            vscode.window.showErrorMessage('Run failed. Could not get run target.');
            return;
        }

        return this.taskService.runTask(
            `run ${bazelTarget}`,
            `run ${bazelTarget}`,
            runCommand,
            this.configurationManager.isClearTerminalBeforeAction(),
            envVars);
    }

    private async runDirect(target: BazelTarget) {
        if (this.configurationManager.isBuildBeforeLaunch()) {
            await this.buildTarget(BUILD_RUN_TARGET_STR);
        }

        const targetPath = await this.bazelService.getBazelTargetBuildPath(target);
        // Program (executable) path with respect to workspace.
        const programPath = path.join(WorkspaceService.getInstance().getWorkspaceFolder().uri.path, targetPath);

        const args = target.getRunArgs().toString();
        const envVars = EnvVarsUtils.listToObject(target.getEnvVars().toStringArray());

        return this.taskService.runTask(`run ${programPath}`, `run ${programPath}`, `${programPath} ${args}`, this.configurationManager.isClearTerminalBeforeAction(), envVars, 'process');
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
        const bazelTarget = this.getBazelTargetName(target.detail);
        let runArgs = target.getRunArgs().toString();
        if (runArgs.length > 0) {
            runArgs = '-- ' + runArgs;
        }

        // Remove any spaces from the command if there are no args
        const config = configArgs ? ' ' + configArgs : '';
        const bArgs = bazelArgs ? ' ' + bazelArgs : '';

        return `${executable} run${bArgs}${config} ${bazelTarget} ${runArgs}\n`;
    }

    private async getRunDirectCommand(target: BazelTarget): Promise<string | undefined> {
        if (!target) {
            return undefined;
        }

        const targetPath = await this.bazelService.getBazelTargetBuildPath(target);
        // Program (executable) path with respect to workspace.
        const programPath = path.join(WorkspaceService.getInstance().getWorkspaceFolder().uri.path, targetPath);
        const runArgs = target.getRunArgs().toString();
        return `${programPath} ${runArgs}`;
    }



}