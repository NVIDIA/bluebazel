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
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetController } from './bazel-target-controller';
import { ConfigurationManager } from '../../services/configuration-manager';
import { TaskService } from '../../services/task-service';
import { BUILD_RUN_TARGET_STR } from '../../common';

export class BuildController implements BazelTargetController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService
    ) { }

    public async execute(target: BazelTarget): Promise<any> {
        const actualTarget = this.getActualBuildTarget(target.label);
        if (!actualTarget) {
            vscode.window.showErrorMessage('Build failed. Could not find run target.');
            return;
        }

        const buildCommand = await this.getExecuteCommand(target);
        if (!buildCommand) {
            vscode.window.showErrorMessage('Build failed. Could not find run target.');
            return;
        }

        return this.taskService.runTask(`${target.action} ${actualTarget}`, `${target.action} ${actualTarget}`, buildCommand, this.configurationManager.isClearTerminalBeforeAction());
    }

    public async getExecuteCommand(target: BazelTarget): Promise<string | undefined> {
        const actualTarget = this.getActualBuildTarget(target.label);
        if (!actualTarget) {
            return undefined;
        }

        const executable = this.configurationManager.getExecutableCommand();
        const buildArgs = target.getBazelArgs();
        const configArgs = target.getConfigArgs();
        const buildEnvVars = target.getEnvVars();
        return `${executable} build ${buildArgs} ${configArgs} ${actualTarget} ${buildEnvVars}\n`;
    }

    private getActualBuildTarget(target: string): string | undefined {
        let actualTarget = target;
        if (target === BUILD_RUN_TARGET_STR) {
            // Find run target
            const runTarget = this.workspaceState.get<RunTarget>(common.WORKSPACE_KEYS.runTarget);
            if (runTarget !== undefined &&
                typeof runTarget === 'object' &&
                runTarget !== null &&
                Object.keys(runTarget).includes('value')) {
                actualTarget = path.relative(common.BAZEL_BIN, runTarget.value);
            } else {
                return undefined;
            }
        }
        return actualTarget;
    }
}