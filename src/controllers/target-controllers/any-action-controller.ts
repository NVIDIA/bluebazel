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
import { ConfigurationManager } from '../../services/configuration-manager';
import { cleanAndFormat } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import { showProgress } from '../../ui/progress';
import * as vscode from 'vscode';


export class AnyActionController implements BazelTargetController {
    private readonly quickPickHistory: Map<BazelAction, BazelTargetPropertyHistory>;
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService,
        private readonly bazelTargetStateManager: BazelTargetStateManager
    ) {
        this.quickPickHistory = new Map<BazelAction, BazelTargetPropertyHistory>();
    }

    public async execute(target: BazelTarget): Promise<void> {
        try {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Executing);
            const executable = this.configurationManager.getExecutableCommand();
            await showProgress(`${target.action} ${target.bazelPath}`, (cancellationToken) => {
                return this.taskService.runTask(
                    `${target.action} ${target.bazelPath}`, // task name
                    `${executable} ${target.action} ${target.bazelPath}`,
                    this.configurationManager.isClearTerminalBeforeAction(),
                    cancellationToken,
                    target.id
                );
            });
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
}