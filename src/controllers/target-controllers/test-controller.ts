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
import { RunController } from './run-controller';
import { BazelEnvironment } from '../../models/bazel-environment';
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetManager } from '../../models/bazel-target-manager';
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { ShellService } from '../../services/shell-service';
import { cleanAndFormat } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import { BazelTargetQuickPickItem } from '../../ui/bazel-target-quick-pick-item';
import { BazelTargetTreeProvider } from '../../ui/bazel-target-tree-provider';
import * as vscode from 'vscode';


export class TestController implements BazelTargetController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly shellService: ShellService,
        private readonly runController: RunController,
        private readonly bazelEnvironment: BazelEnvironment,
        private readonly bazelTargetManager: BazelTargetManager,
        private readonly bazelTreeProvider: BazelTargetTreeProvider
    ) { }

    public async execute(target: BazelTarget) {
        const testCommand = await this.getExecuteCommand(target);
        if (!testCommand) {
            vscode.window.showErrorMessage('Test failed. Could not get test target.');
            return;
        }

        const taskType = `test ${target}`;
        const taskLabel = `test ${target}`;

        return this.taskService.runTask(taskType, taskLabel, testCommand, this.configurationManager.isClearTerminalBeforeAction());
    }

    public async getExecuteCommand(target: BazelTarget): Promise<string | undefined> {

        if (!target) {
            return undefined;
        }
        const executable = this.configurationManager.getExecutableCommand();
        const bazelArgs = target.getBazelArgs();
        const configArgs = target.getConfigArgs();
        const envVars =   EnvVarsUtils.toTestEnvVars(target.getEnvVars().toStringArray());
        const testArgs = target.getRunArgs();

        // target is in the form of a relative path: bazel-bin/path/executable
        // bazelTarget is in the form of //path:executable
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.detail);
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

    public async getTestTargets(target: BazelTarget): Promise<BazelTargetQuickPickItem[]> {
        const testTarget = BazelService.formatBazelTargetFromPath(target.detail);
        const executable = this.configurationManager.getExecutableCommand();
        const testPath = testTarget.replace(new RegExp(/:.*/g), '/...');
        const command = `${executable} query 'tests(${testPath})'`;
        const result = await this.shellService.runShellCommand(command, false).then((value) => {
            return new Promise<BazelTargetQuickPickItem[]>(resolve => {
                const parts = testTarget.split(':');
                const path = parts[0];
                const test = parts[1];
                const testTargets = value.stdout.split('\n');
                testTargets.unshift(`${path}:...`);
                resolve(
                    testTargets.map(item => {
                        const label = `${test}:${item.split(':').slice(-1)[0]}`;
                        const t = new BazelTarget(this.context, label, item, target.action);
                        return {
                            label: label,
                            detail: item,
                            target: t  // Create a copy of target with the updated label
                        };
                    })
                );
            });
        });
        return result;
    }

    public async pickTarget(target?: BazelTarget) {
        this.runController.getRunTargets()
            .then(data => vscode.window.showQuickPick(data))
            .then(res => {
                if (res !== undefined && res.detail !== undefined) {
                    const testTarget = res.target;
                    testTarget.action = 'test';
                    const testTargets = this.getTestTargets(testTarget);
                    testTargets.then(data => vscode.window.showQuickPick(data)).then(pickedItem => {
                        if (pickedItem !== undefined && pickedItem.detail !== undefined) {
                            this.bazelEnvironment.updateSelectedTestTarget(pickedItem.target);
                            if (target !== undefined) {
                                this.bazelTargetManager.updateTarget(pickedItem.target, target);
                            } else {
                                this.bazelTargetManager.addTarget(pickedItem.target);
                            }
                            this.bazelTreeProvider.refresh();
                        }
                    });

                }
            })
            .catch(err => vscode.window.showErrorMessage(err));
    }
}