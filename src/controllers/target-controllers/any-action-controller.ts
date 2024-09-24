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
import { BazelAction, BazelTarget } from '../../models/bazel-target';
import { BazelTargetPropertyHistory } from '../../models/bazel-target-property-history';
import { BazelTargetState, BazelTargetStateManager } from '../../models/bazel-target-state-manager';
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { cleanAndFormat } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import { WorkspaceService } from '../../services/workspace-service';
import { BazelTargetQuickPickItem } from '../../ui/bazel-target-quick-pick-item';
import * as path from 'path';
import * as vscode from 'vscode';


export class AnyActionController implements BazelTargetController {
    private readonly quickPickHistory: Map<BazelAction, BazelTargetPropertyHistory>;
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly bazelService: BazelService,
        private readonly bazelTargetStateManager: BazelTargetStateManager
    ) {
        this.quickPickHistory = new Map<BazelAction, BazelTargetPropertyHistory>();
    }

    public async execute(target: BazelTarget): Promise<void> {
        try {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Executing);
            const executable = this.configurationManager.getExecutableCommand();
            await this.taskService.runTask(
                `${target.action} ${target.detail}`, // task name
                `${executable} ${target.action} ${target.detail}`,
                this.configurationManager.isClearTerminalBeforeAction(),
                target.id
            );
        } catch (error) {
            return Promise.reject(error);
        } finally {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Idle);
        }
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

    public async pickTarget(currentTarget?: BazelTarget): Promise<BazelTarget | undefined> {
        if (!currentTarget) {
            throw new Error('Cannot call pickTarget on AnyActionController without a target that has action field populated');
        }

        const history = this.getOrCreateHistory(currentTarget);
        const targetList = await this.getTargetList();

        const dirBuildTargets = await BazelService.fetchBuildTargetNames(
            this.currentTargetPath,
            WorkspaceService.getInstance().getWorkspaceFolder().uri.path
        );
        this.addDirBuildTargetsToList(dirBuildTargets, targetList);

        const quickPick = this.createQuickPick(targetList, currentTarget, history);
        return this.handleQuickPickSelection(quickPick, currentTarget, history, targetList);
    }

    private getOrCreateHistory(currentTarget: BazelTarget): BazelTargetPropertyHistory {
        let history = this.quickPickHistory.get(currentTarget.action);
        if (!history) {
            history = new BazelTargetPropertyHistory(this.context, `bazel${currentTarget.action}`, 10);
            this.quickPickHistory.set(currentTarget.action, history);
        }
        return history;
    }

    private async getTargetList(): Promise<string[]> {
        return await WorkspaceService.getInstance().getSubdirectoryPaths(
            this.currentTargetPath.replace('//', '')
        );
    }


    private addDirBuildTargetsToList(dirBuildTargets: string[], targetList: string[]): void {
        dirBuildTargets.forEach(targetName => {
            targetList.push(`${this.currentTargetPath === '' ? '//' : this.currentTargetPath}:${targetName}`);
        });
    }

    private createQuickPick(
        targetList: string[],
        currentTarget: BazelTarget,
        history: BazelTargetPropertyHistory
    ): vscode.QuickPick<BazelTargetQuickPickItem> {
        const quickPick = vscode.window.createQuickPick<BazelTargetQuickPickItem>();
        const quickPickItems = targetList.map(label => ({
            label,
            target: new BazelTarget(this.context, this.bazelService, label, label, currentTarget.action)
        } as BazelTargetQuickPickItem));

        const historyTargets = history.getHistory().map(label => ({
            label,
            target: new BazelTarget(this.context, this.bazelService, label, label, currentTarget.action)
        }));

        quickPickItems.unshift({ label: '', kind: vscode.QuickPickItemKind.Separator, target: new BazelTarget(this.context, this.bazelService, '', '', '') });
        quickPickItems.unshift(...historyTargets);
        quickPick.items = quickPickItems;
        quickPick.ignoreFocusOut = true;

        if (this.currentTargetPath.trim().length !== 0) {
            quickPick.buttons = [vscode.QuickInputButtons.Back];
            quickPick.onDidTriggerButton(async item => {
                if (item === vscode.QuickInputButtons.Back) {
                    this.currentTargetPath = path.dirname(this.currentTargetPath);
                    const target = await this.pickTarget(currentTarget);
                    quickPick.hide();
                    return target;
                }
            });
        }

        return quickPick;
    }

    private handleQuickPickSelection(
        quickPick: vscode.QuickPick<BazelTargetQuickPickItem>,
        currentTarget: BazelTarget,
        history: BazelTargetPropertyHistory,
        targetList: string[]
    ): Promise<BazelTarget | undefined> {
        return new Promise(resolve => {
            quickPick.onDidChangeSelection(async value => {
                this.currentTargetPath = '';
                if (value[0]) {
                    const item = value[0] as BazelTargetQuickPickItem;
                    const res = item.label;
                    if (res) {
                        const isCustomInput = !targetList.includes(res);
                        const isTarget = res.includes('...') || res.includes(':');

                        if (!isTarget && !isCustomInput) {
                            this.currentTargetPath = res;
                            const target = await this.pickTarget(currentTarget);
                            quickPick.hide();
                            resolve(target);
                        } else {
                            quickPick.value = item.label;
                            quickPick.hide();

                            vscode.window.showInputBox({ value: item.label }).then(data => {
                                if (data !== undefined) {
                                    item.target.label = data;
                                    item.target.detail = data;
                                    history.add(item.target.label);
                                    resolve(item.target);
                                }
                            });
                        }
                    }
                }
            });

            quickPick.onDidChangeValue(value => {
                const trimmedValue = value.trim();

                // Check if custom input is not empty and not already in the list
                const isCustomInput = trimmedValue !== '' && !quickPick.items.some(target => target.label === trimmedValue);

                if (isCustomInput) {
                    // Remove any previous custom input (if any)
                    const nonCustomItems = quickPick.items.filter(item => item.target?.label !== value);

                    // Add the new custom input to the list
                    quickPick.items = [
                        ...nonCustomItems,
                        {
                            label: trimmedValue,
                            target: new BazelTarget(this.context, this.bazelService, trimmedValue, trimmedValue, currentTarget.action)
                        }
                    ];
                } else {
                    // Reset to the original items if input is empty
                    quickPick.items = quickPick.items.filter(item => !item.target || item.label !== value);
                }
            });

            quickPick.show();
        });
    }
}