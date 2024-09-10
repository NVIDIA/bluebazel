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
import { BazelTarget } from '../../models/bazel-target';
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { ShellService } from '../../services/shell-service';
import { TaskService } from '../../services/task-service';
import { BazelTargetQuickPickItem } from '../../ui/bazel-target-quick-pick-item';
import * as vscode from 'vscode';


export class TestController implements BazelTargetController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly shellService: ShellService
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
        return `${executable} test ${bazelArgs} ${configArgs} ${envVars} ${bazelTarget} ${testArgs}\n`;
    }

    public async getTestTargets(target: BazelTarget): Promise<BazelTargetQuickPickItem[]> {
        const testTarget = BazelService.formatBazelTargetFromPath(target.detail);
        const executable = this.configurationManager.getExecutableCommand();
        const testPath = testTarget.replace(new RegExp(/:.*/g), '/...');
        const command = `${executable} query 'tests(${testPath})'`;
        const result = await this.shellService.runShellCommand(command, false).then((value) => {
            return new Promise<BazelTargetQuickPickItem[]>(resolve => {
                const test = testTarget.split(':').slice(-1)[0];
                resolve(value.stdout.split('\n').map(item => ({ label: test + ':' + item.split(':').slice(-1)[0], detail: item, target: target })));
                // TODO (jabbott): Add ... to the list at the top of all test targets
            });
        });
        return result;
    }
}