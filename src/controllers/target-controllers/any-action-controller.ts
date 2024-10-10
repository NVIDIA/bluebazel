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
import { BazelTargetManager } from '../../models/bazel-target-manager';
import { BazelTargetPropertyHistory } from '../../models/bazel-target-property-history';
import { BazelTargetState, BazelTargetStateManager } from '../../models/bazel-target-state-manager';
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { cleanAndFormat } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import { BazelTargetQuickPickItem } from '../../ui/bazel-target-quick-pick-item';
import * as vscode from 'vscode';


export class AnyActionController implements BazelTargetController {
    private readonly quickPickHistory: Map<BazelAction, BazelTargetPropertyHistory>;
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly bazelService: BazelService,
        private readonly bazelTargetManager: BazelTargetManager,
        private readonly bazelTargetStateManager: BazelTargetStateManager
    ) {
        this.quickPickHistory = new Map<BazelAction, BazelTargetPropertyHistory>();
    }

    public async execute(target: BazelTarget): Promise<void> {
        try {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Executing);
            const executable = this.configurationManager.getExecutableCommand();
            await this.taskService.runTask(
                `${target.action} ${target.buildPath}`, // task name
                `${executable} ${target.action} ${target.buildPath}`,
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
            target.buildPath,
            envVars.toString()
        );

        return `${command}\n`;
    }

    public async pickTarget(currentTarget?: BazelTarget): Promise<BazelTarget | undefined> {
        if (!currentTarget) {
            throw new Error('Cannot call pickTarget on AnyActionController without a target that has action field populated');
        }

        const targets = this.bazelTargetManager.getAvailableTargets();

        const quickPick = vscode.window.createQuickPick<BazelTargetQuickPickItem>();
        quickPick.placeholder = 'Select a Bazel action or type a custom action...';

        // Fetch the list of Bazel actions from BazelService.
        const bazelActions = await this.bazelService.fetchTargetActions();

        // Map Bazel actions to QuickPick items.
        const actionItems: vscode.QuickPickItem[] = bazelActions.map(action => ({
            label: action,
        }));

        quickPick.items = actionItems;

        // Track selected action and current view state
        let currentAction: string | undefined = undefined;

        // Listener for when the user types in the quick pick.
        quickPick.onDidChangeValue(value => {
            if (value && !bazelActions.includes(value)) {
                // Custom input, show all Bazel targets filtered by the input
                showMatchingTargets(value, currentAction);
            } else if (value === '' && currentAction) {
                // Back to action selection if the user deletes the entire input.
                quickPick.items = actionItems;
                currentAction = undefined;
                quickPick.placeholder = 'Select a Bazel action or type a custom action...';
            }
        });

        // Listener for when the user selects an item.
        quickPick.onDidChangeSelection(selection => {
            const selectedAction = selection[0].label;

            if (bazelActions.includes(selectedAction)) {
                currentAction = selectedAction;
                showMatchingTargets('', selectedAction);
            }
        });

        // Function to show matching targets based on user input.
        function showMatchingTargets(filterText: string, action?: string) {
            const targetItems = targets
                .filter(target =>
                    (target.label.includes(filterText) || target.bazelPath.includes(filterText)) &&
                    (!action || target.action === action)
                )
                .map(target => ({
                    label: target.label,
                    description: target.bazelPath, // Bazel path displayed below the label
                    detail: action ? `Action: ${action}` : '',
                    target: target, // Store the BazelTarget object for later use
                }));

            if (targetItems.length > 0) {
                quickPick.items = targetItems;
                quickPick.placeholder = 'Select a Bazel target...';
            } else {
                quickPick.items = [{ label: 'No matching targets found.' }];
            }
        }

        // Handle user selection of a target.
        quickPick.onDidAccept(() => {
            const selection = quickPick.selectedItems[0];
            if (selection && selection.target) {
                // Do something with the selected BazelTarget
                vscode.window.showInformationMessage(`Selected Target: ${selection.label}`);
            } else if (currentAction) {
                // User typed a custom action, show targets for it
                showMatchingTargets('', currentAction);
            } else {
                vscode.window.showInformationMessage(`Selected Action: ${selection.label}`);
            }
            quickPick.hide();
        });

        // Show the initial action selection list.
        quickPick.show();

        return undefined;
    }


}