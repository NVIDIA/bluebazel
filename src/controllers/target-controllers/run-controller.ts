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
import { BuildController } from './build-controller';
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetManager } from '../../models/bazel-target-manager';
import { BazelTargetState, BazelTargetStateManager } from '../../models/bazel-target-state-manager';
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { LaunchConfigService } from '../../services/launch-config-service';
import { cleanAndFormat } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import { WorkspaceService } from '../../services/workspace-service';
import { BazelTargetQuickPickItem } from '../../ui/bazel-target-quick-pick-item';
import { BazelController } from '../bazel-controller';
import * as path from 'path';
import * as vscode from 'vscode';


export class RunController implements BazelTargetController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly bazelService: BazelService,
        private readonly launchConfigService: LaunchConfigService,
        private readonly bazelController: BazelController,
        private readonly buildController: BuildController,
        private readonly bazelTargetManager: BazelTargetManager,
        private readonly bazelTargetStateManager: BazelTargetStateManager
    ) { }

    public async execute(target: BazelTarget): Promise<void> {
        try {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Executing);
            if (!this.configurationManager.shouldRunBinariesDirect()) {
                await this.runInBazel(target);
            } else {
                await this.runDirect(target);
            }
        } catch (error) {
            return Promise.reject(error);
        } finally {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Idle);
        }
    }

    private async runInBazel(target: BazelTarget) {

        const envVars = EnvVarsUtils.listToObject(target.getEnvVars().toStringArray());
        // target is in the form of a relative path: bazel-bin/path/executable
        // bazelTarget is in the form of //path:executable
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.detail);

        const runCommand = this.getRunInBazelCommand(target);
        if (!runCommand) {
            vscode.window.showErrorMessage('Run failed. Could not get run target.');
            return;
        }

        return this.taskService.runTask(
            `${target.action} ${bazelTarget}`,
            runCommand,
            this.configurationManager.isClearTerminalBeforeAction(),
            target.id,
            envVars);
    }

    public async getRunTargets(cancellationToken?: vscode.CancellationToken): Promise<BazelTargetQuickPickItem[]> {
        let runTargets = this.bazelTargetManager.getAvailableRunTargets();

        // If no available run targets, refresh them
        if (runTargets.length === 0) {
            try {
                // Await refresh and ensure any errors are caught in the calling function
                await this.bazelController.refreshAvailableRunTargets(cancellationToken);
                runTargets = this.bazelTargetManager.getAvailableRunTargets();  // Refresh the list
            } catch (error) {
                return Promise.reject(error);  // Propagate the rejection
            }
        }

        // Map run targets to QuickPick items
        const items: BazelTargetQuickPickItem[] = runTargets.map(runTarget => ({
            label: runTarget.label,
            detail: runTarget.detail,
            target: runTarget,
        }));

        return items;  // Return the QuickPick items
    }

    private async runDirect(target: BazelTarget) {
        if (this.configurationManager.isBuildBeforeLaunch()) {
            await this.buildController.execute(target);
        }

        const targetPath = await this.bazelService.getBazelTargetBuildPath(target);
        // Program (executable) path with respect to workspace.
        const programPath = path.join(WorkspaceService.getInstance().getWorkspaceFolder().uri.path, targetPath);

        const args = target.getRunArgs().toString();
        const envVars = EnvVarsUtils.listToObject(target.getEnvVars().toStringArray());

        return this.taskService.runTask(`${target.action} ${programPath}`, `${programPath} ${args}`, this.configurationManager.isClearTerminalBeforeAction(), target.id, envVars, 'process');
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
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.detail);
        let runArgs = target.getRunArgs().toString();
        if (runArgs.length > 0) {
            runArgs = '-- ' + runArgs;
        }

        // Remove extra whitespaces
        const command = cleanAndFormat(
            executable,
            'run',
            bazelArgs.toString(),
            configArgs.toString(),
            bazelTarget,
            runArgs
        );

        return `${command}\n`;
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

    public async pickTarget(): Promise<BazelTarget | undefined> {
        return new Promise((resolve) => {
            // Create a QuickPick
            const quickPick = vscode.window.createQuickPick<BazelTargetQuickPickItem>();
            const cancellationTokenSource = new vscode.CancellationTokenSource();
            // Set placeholder text to indicate that loading is in progress
            quickPick.placeholder = 'Loading run targets...';

            // Show a loading message or spinner (using icon)
            quickPick.items = [{ label: '$(sync~spin) Loading...', alwaysShow: true, detail: undefined, target: new BazelTarget(this.context, this.bazelService, '', '', '') }];

            // Show the QuickPick UI
            quickPick.show();

            // Fetch the run targets asynchronously
            this.getRunTargets(cancellationTokenSource.token)
                .then(data => {
                    quickPick.placeholder = 'Pick target...';
                    // Once the data is loaded, update the QuickPick items
                    quickPick.items = data;

                    // Remove the loading message once the actual items are available
                    if (quickPick.items.length > 0) {
                        quickPick.activeItems = [quickPick.items[0]];  // Optionally, set the first item as active
                    }
                })
                .catch(err => {
                    vscode.window.showErrorMessage(`Error loading targets: ${err}`);
                    resolve(undefined);  // Resolve with undefined on error
                });

            // Handle selection
            quickPick.onDidChangeSelection(selection => {
                const selectedItem = selection[0];  // Get the first selected item

                if (selectedItem && selectedItem.target) {
                    // Refresh launch configs with the selected target
                    // TODO (jabbottn): Fix this so it refreshes everywhere
                    // the target changes.
                    // this.launchConfigService.refreshLaunchConfigs(selectedItem.target);
                    resolve(selectedItem.target);  // Resolve with the selected target
                } else {
                    resolve(undefined);  // Resolve with undefined if no valid target
                }

                quickPick.dispose();  // Close the QuickPick UI
            });

            // Handle when the user cancels the QuickPick
            quickPick.onDidHide(() => {
                cancellationTokenSource.cancel();
                cancellationTokenSource.dispose();
                quickPick.dispose();
                resolve(undefined);
            });
        });
    }
}