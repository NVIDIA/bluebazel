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
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetManager } from '../../models/bazel-target-manager';
import { BazelTargetState, BazelTargetStateManager } from '../../models/bazel-target-state-manager';
import { BAZEL_BIN, BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { cleanAndFormat } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import { WorkspaceService } from '../../services/workspace-service';
import { BazelTargetQuickPickItem } from '../../ui/bazel-target-quick-pick-item';
import * as path from 'path';
import * as vscode from 'vscode';



export const BUILD_RUN_TARGET_STR = '<Run Target>';

export class BuildController implements BazelTargetController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly bazelService: BazelService,
        private readonly bazelTargetManager: BazelTargetManager,
        private readonly bazelTargetStateManager: BazelTargetStateManager
    ) { }

    public async execute(target: BazelTarget): Promise<void> {
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

        try {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Executing);
            await this.taskService.runTask(`${target.action} ${actualTarget}`, buildCommand, this.configurationManager.isClearTerminalBeforeAction(), target.id);
        } catch (error) {
            return Promise.reject(error);
        } finally {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Idle);
        }
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

    private getActualBuildTarget(target: string): string | undefined {
        let actualTarget = target;
        if (target === BUILD_RUN_TARGET_STR) {
            // Find run target
            const runTarget = this.bazelTargetManager.getSelectedTarget('run');
            if (runTarget !== undefined &&
                typeof runTarget === 'object' &&
                runTarget !== null &&
                Object.keys(runTarget).includes('detail')) {
                actualTarget = path.relative(BAZEL_BIN, runTarget.detail);
            } else {
                return undefined;
            }
        } else {
            actualTarget = path.relative(BAZEL_BIN, target);
        }
        return actualTarget;
    }

    private currentTargetPath = '';

    public async pickTarget(currentTarget?: BazelTarget): Promise<BazelTarget | undefined>
    {
        const targetList = await WorkspaceService.getInstance().getSubdirectoryPaths(this.currentTargetPath.replace('//', ''));
        // Prepend current run target option if we are in the root directory
        if (this.currentTargetPath.trim().length === 0) {
            targetList.unshift(BUILD_RUN_TARGET_STR);
        }

        const dirBuildTargets = await BazelService.fetchBuildTargetNames(
            this.currentTargetPath,
            WorkspaceService.getInstance().getWorkspaceFolder().uri.path
        );

        // Add each target to the data array
        dirBuildTargets.forEach(targetName => {
            targetList.push(`${this.currentTargetPath === '' ? '//' : this.currentTargetPath}:${targetName}`);
        });

        const quickPick = vscode.window.createQuickPick();
        quickPick.items = targetList.map(label => ({
            label: label,
            // Leave out 'detail' key here as it would be redundant to label
            target: new BazelTarget(this.context, this.bazelService, label, label, 'build')
        } as BazelTargetQuickPickItem));
        if (this.currentTargetPath.trim().length !== 0) {
            quickPick.buttons = [vscode.QuickInputButtons.Back];
            quickPick.onDidTriggerButton(async item => {
                if (item === vscode.QuickInputButtons.Back) {
                    this.currentTargetPath = path.dirname(this.currentTargetPath);
                    const target = await this.pickTarget(currentTarget);
                    return target;
                }
            });
        }

        return new Promise((resolve) => {
            quickPick.onDidChangeSelection(async value => {
                this.currentTargetPath = '';
                if (value[0]) {
                    const item = value[0] as BazelTargetQuickPickItem;
                    const res = item.label;
                    if (res !== undefined) {
                        if (typeof res === 'string' && !res.includes('...') && res !== BUILD_RUN_TARGET_STR && !res.includes(':')) {
                            this.currentTargetPath = res;
                            const target = await this.pickTarget(currentTarget);
                            quickPick.hide();
                            resolve(target);
                        } else {
                            this.currentTargetPath = '';
                            quickPick.hide();
                            resolve(item.target);
                        }
                    }
                }
            });

            quickPick.show();
        });
    }
}