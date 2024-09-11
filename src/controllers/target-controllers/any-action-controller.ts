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
import { ConfigurationManager } from '../../services/configuration-manager';
import { cleanAndFormat } from '../../services/string-utils';
import { TaskService } from '../../services/task-service';
import * as vscode from 'vscode';


export class AnyActionController implements BazelTargetController {
    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly taskService: TaskService
    ) { }

    public async execute(target: BazelTarget): Promise<any> {
        const executable = this.configurationManager.getExecutableCommand();
        await this.taskService.runTask(
            target.action, // task type
            target.action, // task name
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

    public async pickTarget(target?: BazelTarget) {

    }

}