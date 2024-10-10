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
import { RunController } from './run-controller';
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetState, BazelTargetStateManager } from '../../models/bazel-target-state-manager';
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { ShellService } from '../../services/shell-service';
import { cleanAndFormat } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import { BazelTargetQuickPickItem } from '../../ui/bazel-target-quick-pick-item';
import * as vscode from 'vscode';


export class TestController implements BazelTargetController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly shellService: ShellService,
        private readonly bazelService: BazelService,
        private readonly runController: RunController,
        private readonly bazelTargetStateManager: BazelTargetStateManager
    ) { }

    public async execute(target: BazelTarget) {
        const testCommand = await this.getExecuteCommand(target);
        if (!testCommand) {
            vscode.window.showErrorMessage('Test failed. Could not get test target.');
            return;
        }

        const taskLabel = `${target.action} ${target.buildPath}`;

        try {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Executing);
            await this.taskService.runTask(taskLabel, testCommand, this.configurationManager.isClearTerminalBeforeAction(), target.id);
        } catch (error) {
            return Promise.reject(error);
        } finally {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Idle);
        }
    }

    public async getExecuteCommand(target: BazelTarget): Promise<string | undefined> {

        if (!target) {
            return undefined;
        }
        const executable = this.configurationManager.getExecutableCommand();
        const bazelArgs = target.getBazelArgs();
        const configArgs = target.getConfigArgs();
        const envVars = EnvVarsUtils.toTestEnvVars(target.getEnvVars().toStringArray());
        const testArgs = target.getRunArgs();

        const bazelTarget = target.buildPath;
        const command = cleanAndFormat(
            executable,
            'test',
            bazelArgs.toString(),
            configArgs.toString(),
            envVars,
            bazelTarget,
            testArgs.toString()
        );

        return `${command}\n`;
    }

    public async getTestTargets(target: BazelTarget, cancellationToken?: vscode.CancellationToken): Promise<BazelTargetQuickPickItem[]> {
        const testTarget = BazelService.formatBazelTargetFromPath(target.buildPath);
        const executable = this.configurationManager.getExecutableCommand();
        const testPath = testTarget.replace(new RegExp(/:.*/g), '/...');
        const command = `${executable} query 'tests(${testPath})'`;
        return this.shellService.runShellCommand(command, cancellationToken).then((value) => {
            return new Promise<BazelTargetQuickPickItem[]>(resolve => {
                const parts = testTarget.split(':');
                const path = parts[0];
                const test = parts[1];
                const testTargetNames = value.stdout.split('\n');
                const testTargets = testTargetNames.map(item => {
                    const label = `${test}:${item.split(':').slice(-1)[0]}`;
                    const t = new BazelTarget(this.context, this.bazelService, label, item, item, target.action, '');
                    return {
                        label: t.label,
                        detail: t.buildPath,
                        target: t  // Create a copy of target with the updated label
                    };
                });
                // Create the special all inclusive target ...
                const allTestsInPath = `${path}/...`;
                const label = `${path.split('/').slice(-1)[0]}/...`;
                const t = new BazelTarget(this.context, this.bazelService, label, allTestsInPath, allTestsInPath, target.action, '');
                testTargets.unshift({
                    label: t.label,
                    detail: t.buildPath,
                    target: t
                });

                resolve(testTargets);

            });
        });
    }

    public async pickTarget(): Promise<BazelTarget | undefined> {
        return new Promise((resolve) => {
            // Create a QuickPick
            const quickPick = vscode.window.createQuickPick<BazelTargetQuickPickItem>();
            const cancellationTokenSource = new vscode.CancellationTokenSource();

            // Set placeholder text to indicate loading
            quickPick.placeholder = 'Loading test targets...';

            // Show a loading message or spinner (using icon)
            quickPick.items = [{ label: '$(sync~spin) Loading...', alwaysShow: true, detail: undefined, target: BazelTarget.createEmpty(this.context, this.bazelService) }];

            // Show the QuickPick UI
            quickPick.show();

            // Fetch the run targets asynchronously
            this.runController.getRunTargets(cancellationTokenSource.token)
                .then(data => {
                    quickPick.placeholder = 'Pick a target to test...';
                    quickPick.items = data;  // Update QuickPick items with the fetched targets

                    if (quickPick.items.length > 0) {
                        quickPick.activeItems = [quickPick.items[0]];  // Optionally, set the first item as active
                    }
                })
                .catch(err => {
                    vscode.window.showErrorMessage(`Error loading run targets: ${err}`);
                    resolve(undefined);  // Resolve with undefined on error
                });

            // Handle selection for the run target
            quickPick.onDidChangeSelection(selection => {
                const selectedItem = selection[0];  // Get the first selected item

                if (selectedItem && selectedItem.target) {
                    const testTarget = selectedItem.target;
                    testTarget.action = 'test';

                    // Fetch test targets for the selected run target
                    this.getTestTargets(testTarget, cancellationTokenSource.token)
                        .then(testTargets => {
                            // Show another QuickPick for test targets
                            return vscode.window.showQuickPick(testTargets);
                        })
                        .then(pickedItem => {
                            if (pickedItem && pickedItem.target) {
                                resolve(pickedItem.target);  // Resolve with the selected test target
                            } else {
                                resolve(undefined);  // Resolve with undefined if no valid test target
                            }
                        })
                        .catch(err => {
                            vscode.window.showErrorMessage(`Error loading test targets: ${err}`);
                            resolve(undefined);  // Resolve with undefined on error
                        });

                    quickPick.dispose();  // Close the QuickPick after selecting the run target
                }
            });

            // Handle cancellation or closing of the QuickPick
            quickPick.onDidHide(() => {
                cancellationTokenSource.cancel();
                cancellationTokenSource.dispose();
                quickPick.dispose();
                resolve(undefined);  // Resolve with undefined when the user cancels
            });
        });
    }
}