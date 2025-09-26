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
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetManager } from '../../models/bazel-target-manager';
import { BazelTargetState, BazelTargetStateManager } from '../../models/bazel-target-state-manager';
import { BAZEL_BIN } from '../../services/bazel-parser';
import { ConfigurationManager } from '../../services/configuration-manager';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { cleanAndFormat } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import { showProgress } from '../../ui/progress';
import * as path from 'path';
import * as vscode from 'vscode';



export const BUILD_RUN_TARGET_STR = '<Run Target>';

export class BuildController implements BazelTargetController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly bazelTargetManager: BazelTargetManager,
        private readonly bazelTargetStateManager: BazelTargetStateManager
    ) { }

    public async execute(target: BazelTarget): Promise<void> {
        const actualTarget = this.getActualBuildTargetPath(target);
        if (!actualTarget) {
            vscode.window.showErrorMessage('Build failed. Could not find run target.');
            return;
        }

        const buildCommand = await this.getExecuteCommand(target);
        if (!buildCommand) {
            vscode.window.showErrorMessage('Build failed. Could not find run target.');
            return;
        }

        // Both the run and debug controllers can call build,
        // we don't want to change the state if it isn't idle.
        const shouldChangeState = this.bazelTargetStateManager.getTargetState(target) === BazelTargetState.Idle;
        try {
            if (shouldChangeState) {
                this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Executing);
            }
            await showProgress(`Building ${actualTarget}`, (cancellationToken) => {
                return this.taskService.runTask(`${target.action} ${actualTarget}`,
                    buildCommand, this.configurationManager.isClearTerminalBeforeAction(), cancellationToken, target.id);
            });
        } catch (error) {
            return Promise.reject(error);
        } finally {
            if (shouldChangeState) {
                this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Idle);
            }
        }
    }

    public async getExecuteCommand(target: BazelTarget): Promise<string | undefined> {
        const actualTarget = this.getActualBuildTargetPath(target);
        if (!actualTarget) {
            return undefined;
        }

        const executable = this.configurationManager.getExecutableCommand();
        const buildArgs = target.getBazelArgs().toString();
        const configArgs = target.getConfigArgs().toString();
        const buildEnvVars = EnvVarsUtils.toBuildEnvVars(target.getEnvVars().toStringArray());
        // Clean and format the command by removing extra spaces and empty strings
        const command = cleanAndFormat(
            executable,
            'build',
            buildArgs,
            configArgs,
            actualTarget,
            buildEnvVars
        );

        return `${command}\n`;
    }

    private getActualBuildTargetPath(target: BazelTarget): string | undefined {
        let actualTarget = target.bazelPath;
        if (target.buildPath === BUILD_RUN_TARGET_STR) {
            // Find run target
            const runTarget = this.bazelTargetManager.getSelectedTarget('run');
            if (runTarget !== undefined &&
                typeof runTarget === 'object' &&
                runTarget !== null &&
                Object.keys(runTarget).includes('detail')) {
                actualTarget = path.relative(BAZEL_BIN, runTarget.buildPath);
            } else {
                return undefined;
            }
        }
        return actualTarget;
    }

}