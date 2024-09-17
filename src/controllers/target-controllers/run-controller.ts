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
import { BuildController } from './build-controller';
import { BazelEnvironment } from '../../models/bazel-environment';
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetManager } from '../../models/bazel-target-manager';
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { LaunchConfigService } from '../../services/launch-config-service';
import { cleanAndFormat } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import { WorkspaceService } from '../../services/workspace-service';
import { BazelTargetQuickPickItem } from '../../ui/bazel-target-quick-pick-item';
import { BazelTargetTreeProvider } from '../../ui/bazel-target-tree-provider';
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
        private readonly bazelEnvironment: BazelEnvironment,
        private readonly bazelTargetManager: BazelTargetManager,
        private readonly bazelTreeProvider: BazelTargetTreeProvider
    ) { }

    public async execute(target: BazelTarget): Promise<void> {
        if (!this.configurationManager.shouldRunBinariesDirect()) {
            return this.runInBazel(target);
        } else {
            return this.runDirect(target);
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
            `run ${bazelTarget}`,
            `run ${bazelTarget}`,
            runCommand,
            this.configurationManager.isClearTerminalBeforeAction(),
            envVars);
    }

    public async getRunTargets(): Promise<BazelTargetQuickPickItem[]> {
        let runTargets = this.bazelTargetManager.getAvailableRunTargets();
        if (runTargets.length == 0) {
            await this.bazelController.refreshAvailableRunTargets();
            runTargets = this.bazelTargetManager.getAvailableRunTargets();
        }

        const items: BazelTargetQuickPickItem[] = [];
        runTargets.forEach(runTarget => {
            items.push({ label: runTarget.label, detail: runTarget.detail, target: runTarget });
        });
        return items;
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

        return this.taskService.runTask(`run ${programPath}`, `run ${programPath}`, `${programPath} ${args}`, this.configurationManager.isClearTerminalBeforeAction(), envVars, 'process');
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

    public async pickTarget(target?: BazelTarget) {
        this.getRunTargets()
            .then(data => vscode.window.showQuickPick(data))
            .then(res => {
                if (res !== undefined && res.detail !== undefined) {
                    this.launchConfigService.refreshLaunchConfigs(res.target);
                    if (target !== undefined && target.detail !== '') {
                        this.bazelTargetManager.updateTarget(res.target, target);
                    } else {
                        this.bazelTargetManager.addTarget(res.target);
                    }

                    this.bazelTreeProvider.refresh();
                }
            })
            .catch(err => vscode.window.showErrorMessage(err));
    }
}