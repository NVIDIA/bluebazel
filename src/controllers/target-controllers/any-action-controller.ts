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
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { cleanAndFormat } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import { WorkspaceService } from '../../services/workspace-service';
import { BazelTargetQuickPickItem } from '../../ui/bazel-target-quick-pick-item';
import { BazelTargetTreeProvider } from '../../ui/bazel-target-tree-provider';
import * as path from 'path';
import * as vscode from 'vscode';


export class AnyActionController implements BazelTargetController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly bazelService: BazelService,
        private readonly bazelTargetManager: BazelTargetManager,
        private readonly bazelTreeProvider: BazelTargetTreeProvider
    ) { }

    public async execute(target: BazelTarget): Promise<void> {
        const executable = this.configurationManager.getExecutableCommand();
        await this.taskService.runTask(
            `${target.action} ${target.detail}`, // task type
            `${target.action} ${target.detail}`, // task name
            `${executable} ${target.action} ${target.detail}`,
            this.configurationManager.isClearTerminalBeforeAction()
        );
    }

    public async getExecuteCommand(target: BazelTarget): Promise<string | undefined> {
        const executable = this.configurationManager.getExecutableCommand();
        const args = target.getBazelArgs();
        const configArgs = target.getConfigArgs();
        const envVars = target.getEnvVars();
        const command = cleanAndFormat(
            executable,
            target.action,
            args.toString(),
            configArgs.toString(),
            target.detail,
            envVars.toString()
        );

        return `${command}\n`;
    }

    private currentTargetPath = '';
    public async pickTarget(currentTarget?: BazelTarget) {
        if (currentTarget === undefined) {
            throw Error('Cannot call pickTarget on AnyActionController without a target that has action field populated');
        }
        const targetList = await WorkspaceService.getInstance().getSubdirectoryPaths(this.currentTargetPath.replace('//', ''));

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
            target: new BazelTarget(this.context, this.bazelService, label, label, currentTarget.action)
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
                    if (typeof res === 'string' && !res.includes('...') && !res.includes(':') ) {
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