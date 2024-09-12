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
import { BazelTargetManager } from '../../models/bazel-target-manager';
import { BAZEL_BIN, BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { cleanAndFormat } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import { WorkspaceService } from '../../services/workspace-service';
import { BazelTargetQuickPickItem } from '../../ui/bazel-target-quick-pick-item';
import { BazelTargetTreeProvider } from '../../ui/bazel-target-tree-provider';
import * as path from 'path';
import * as vscode from 'vscode';



export const BUILD_RUN_TARGET_STR = '<Run Target>';

export class BuildController implements BazelTargetController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly bazelEnvironment: BazelEnvironment,
        private readonly bazelTargetManager: BazelTargetManager,
        private readonly bazelTreeProvider: BazelTargetTreeProvider,
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

    private currentTargetPath = '';

    public async pickTarget(currentTarget?: BazelTarget)
    {
        const targetList = await WorkspaceService.getInstance().getSubdirectoryPaths(this.currentTargetPath.replace('//', ''));
        // Prepend current run target option if we are in the root directory
        if (this.currentTargetPath.trim().length === 0) {
            targetList.unshift(BUILD_RUN_TARGET_STR);
        }

        const dirBuildTargets = await BazelService.fetchBuildTargets(
            this.currentTargetPath,
            WorkspaceService.getInstance().getWorkspaceFolder().uri.path
        );

        // Add each target to the data array
        dirBuildTargets.forEach(targetName => {
            targetList.push(`//${this.currentTargetPath}:${targetName}`);
        });

        const quickPick = vscode.window.createQuickPick();
        quickPick.items = targetList.map(label => ({
            label: label,
            // Leave out 'detail' key here as it would be redundant to label
            target: new BazelTarget(this.context, label, label, 'build')
        } as BazelTargetQuickPickItem));
        if (this.currentTargetPath.trim().length !== 0) {
            quickPick.buttons = [vscode.QuickInputButtons.Back];
            quickPick.onDidTriggerButton(item => {
                if (item === vscode.QuickInputButtons.Back) {
                    this.currentTargetPath = path.dirname(this.currentTargetPath);
                    this.pickTarget(currentTarget);

                }
            });
        }

        quickPick.onDidChangeSelection(value => {
            this.currentTargetPath = '';
            if (value[0]) {
                const item = value[0] as BazelTargetQuickPickItem;
                const res = item.label;
                if (res !== undefined) {
                    if (typeof res === 'string' && !res.includes('...') && res !== BUILD_RUN_TARGET_STR && !res.includes(':') ) {
                        this.currentTargetPath = res;
                        this.pickTarget(currentTarget);
                    } else {
                        this.currentTargetPath = '';
                        quickPick.hide();
                        if (currentTarget && currentTarget.detail !== '') {
                            this.bazelTargetManager.updateTarget(item.target, currentTarget);
                        } else {
                            this.bazelTargetManager.addTarget(item.target);
                        }
                        this.bazelTreeProvider.refresh();
                    }
                }
            }
        });

        quickPick.show();
    }
}