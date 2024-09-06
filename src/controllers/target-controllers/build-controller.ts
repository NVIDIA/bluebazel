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

import { BazelTargetController } from './bazel-target-controller';
import { BazelEnvironment } from '../../models/bazel-environment';
import { BazelTarget } from '../../models/bazel-target';
import { BAZEL_BIN } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { TaskService } from '../../services/task-service';
import * as path from 'path';
import * as vscode from 'vscode';



export const BUILD_RUN_TARGET_STR = '<Run Target>';

export class BuildController implements BazelTargetController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly bazelEnvironment: BazelEnvironment
    ) { }

    public async execute(target: BazelTarget): Promise<any> {
        const actualTarget = this.getActualBuildTarget(target.detail);
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
        const actualTarget = this.getActualBuildTarget(target.detail);
        if (!actualTarget) {
            return undefined;
        }

        const executable = this.configurationManager.getExecutableCommand();
        const buildArgs = target.getBazelArgs().toString();
        const configArgs = target.getConfigArgs().toString();
        const buildEnvVars = EnvVarsUtils.toBuildEnvVars(target.getEnvVars().toStringArray());
        return `${executable} build ${buildArgs} ${configArgs} ${actualTarget} ${buildEnvVars}\n`;
    }

    private getActualBuildTarget(target: string): string | undefined {
        let actualTarget = target;
        if (target === BUILD_RUN_TARGET_STR) {
            // Find run target
            const runTarget = this.bazelEnvironment.getSelectedRunTarget();
            if (runTarget !== undefined &&
                typeof runTarget === 'object' &&
                runTarget !== null &&
                Object.keys(runTarget).includes('detail')) {
                actualTarget = path.relative(BAZEL_BIN, runTarget.detail);
            } else {
                return undefined;
            }
        }
        return actualTarget;
    }
}