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
import * as vscode from 'vscode';

import { BazelEnvironment } from '../models/bazel-environment';
import { BazelService } from '../services/bazel-service';
import { ConfigurationManager } from '../services/configuration-manager';
import { ShellService } from '../services/shell-service';
import { TaskService } from '../services/task-service';

/**
 * Controller class for executing user custom commands.
 */
export class UserCommandsController {

    private static CONFIG_KEYWORDS = {
        executable: 'bluebazel.executable',
        runTarget: 'bluebazel.runTarget',
        buildTarget: 'bluebazel.buildTarget',
        testTarget: 'bluebazel.testTarget',
        runArgs: 'bluebazel.runArgs',
        testArgs: 'bluebazel.testArgs',
        buildConfigs: 'bluebazel.buildConfigs',
        runConfigs: 'bluebazel.runConfigs',
        testConfigs: 'bluebazel.testConfigs',
        bazelBuildArgs: 'bluebazel.bazelBuildArgs',
        bazelRunArgs: 'bluebazel.bazelRunArgs',
        bazelTestArgs: 'bluebazel.bazelTestArgs',
        buildEnvVars: 'bluebazel.buildEnvVars',
        runEnvVars: 'bluebazel.runEnvVars',
        testEnvVars: 'bluebazel.testEnvVars',
        formatCommand: 'bluebazel.formatCommand'
    };

    private static EXTENSION_COMMANDS = {
        pick: 'Pick',
        input: 'Input'
    };

    constructor(
        private readonly configurationManager: ConfigurationManager,
        private readonly shellService: ShellService, // Inject the services
        private readonly taskService: TaskService,
        private readonly bazelEnvironment: BazelEnvironment
    ) { }

    public async runCustomTask(command: string): Promise<void> {
        let completeCommand = this.resolveKeywords(command);
        completeCommand = await this.resolveExtensionCommands(completeCommand);
        completeCommand = await this.resolveCommands(completeCommand);
        this.taskService.runTask(`${completeCommand}`, completeCommand, completeCommand, this.configurationManager.isClearTerminalBeforeAction());
    }

    private static formatTestArgs(testArgs: string): string {
        const value = testArgs;
        const pattern = /(--\S+)/g;
        const result = value.replace(pattern, '--test_arg $1');
        return result;
    }
    private resolveKeyword(keyword: string): string {
        const buildTarget = this.bazelEnvironment.getSelectedBuildTarget();
        const runTarget = this.bazelEnvironment.getSelectedRunTarget();
        const testTarget = this.bazelEnvironment.getSelectedTestTarget();


        const keywordMap: Map<string, () => string> = new Map([
            [UserCommandsController.CONFIG_KEYWORDS.runArgs, () => runTarget.getRunArgs().toString()],
            [UserCommandsController.CONFIG_KEYWORDS.testArgs, () => UserCommandsController.formatTestArgs(testTarget.getRunArgs().toString())],
            [UserCommandsController.CONFIG_KEYWORDS.runTarget, () => {
                return BazelService.formatBazelTargetFromPath(runTarget.detail);
            }],
            [UserCommandsController.CONFIG_KEYWORDS.testTarget, () => testTarget.detail],
            [UserCommandsController.CONFIG_KEYWORDS.buildConfigs, () => buildTarget.getConfigArgs().toString()],
            [UserCommandsController.CONFIG_KEYWORDS.runConfigs, () => runTarget.getConfigArgs().toString()],
            [UserCommandsController.CONFIG_KEYWORDS.testConfigs, () => testTarget.getConfigArgs().toString()],
            [UserCommandsController.CONFIG_KEYWORDS.bazelBuildArgs, () => buildTarget.getBazelArgs().toString()],
            [UserCommandsController.CONFIG_KEYWORDS.bazelRunArgs, () => runTarget.getBazelArgs().toString()],
            [UserCommandsController.CONFIG_KEYWORDS.bazelTestArgs, () => testTarget.getBazelArgs().toString()],
            [UserCommandsController.CONFIG_KEYWORDS.buildEnvVars, () => buildTarget.getEnvVars().toStringArray().join(' ')],
            [UserCommandsController.CONFIG_KEYWORDS.runEnvVars, () => runTarget.getEnvVars().toStringArray().join(' ')],
            [UserCommandsController.CONFIG_KEYWORDS.testEnvVars, () => buildTarget.getEnvVars().toStringArray().join(' ')],
            [UserCommandsController.CONFIG_KEYWORDS.buildTarget, () => testTarget.detail],
            [UserCommandsController.CONFIG_KEYWORDS.executable, () => this.configurationManager.getExecutableCommand()],
            [UserCommandsController.CONFIG_KEYWORDS.formatCommand, () => this.configurationManager.getFormatCommand()],
        ]);

        const getValue = keywordMap.get(keyword);
        return getValue ? getValue() : `\${${keyword}}`;

    }

    private async extPick(input: string): Promise<string> {
        // Evaluate the inner command of the pick
        const output = await this.resolveCommands(input);
        console.log(output);
        // Make a list of the output
        const outputList = [];
        for (const element of output.split('\n')) {
            const elementTrimmed = element.trim();
            if (elementTrimmed.length > 0) outputList.push(elementTrimmed);
        }
        console.log(outputList);

        let res = '';
        await vscode.window.showQuickPick(outputList, { 'ignoreFocusOut': true }).then(data => {
            if (data !== undefined)
                res = data;
        });
        return res;
    }

    private async resolveExtensionCommands(input: string) {
        // Execute commands
        let output = input;
        const regexp = /\[([^\s]*)\(([^\s]*)\)\]/g;
        let match;
        do {
            match = regexp.exec(input);
            if (match) {
                const extCommand = match[1];
                const extArgs = match[2];
                let evalRes = '';
                if (extCommand === UserCommandsController.EXTENSION_COMMANDS.pick) {
                    evalRes = await this.extPick(extArgs);
                } else if (extCommand === UserCommandsController.EXTENSION_COMMANDS.input) {
                    await vscode.window.showInputBox(
                        {value: extArgs}
                    ).then((val) => {
                        if (val !== undefined) {
                            evalRes = val;
                        }
                    });
                }
                output = output.replace(match[0], evalRes);
            }
        } while (match);
        return output;
    }

    private resolveKeywords(input: string): string {
        let output = input;
        // First replace keywords
        const regexp = /\$\{([^\s]*)\}/g;
        let match;
        do {
            match = regexp.exec(input);
            if (match) {
                output = output.replace(match[0], this.resolveKeyword(match[1]));
            }
        } while (match);
        return output;
    }

    private async resolveCommands(input: string): Promise<string> {
        // Execute commands
        let output = input;
        const regexp = /<([^\s]*)>/g;
        let match;
        do {
            match = regexp.exec(input);
            if (match) {
                const currentCommand = await this.resolveCommandByKeyword(match[1]);
                console.log(`Current command: ${currentCommand}`);
                const evalRes = await this.shellService.runShellCommand(currentCommand, this.configurationManager.isShowShellCommandOutput());

                output = output.replace(match[0], evalRes.stdout);
            }
        } while (match);
        return output;
    }

    private async resolveCommandByKeyword(keyword: string): Promise<string> {
        const commands = this.configurationManager.getShellCommands();
        let res = '';

        for (const element of commands) {
            if (keyword === element.name) {
                res = this.resolveKeywords(element.command);
                res = await this.resolveExtensionCommands(res);
                res = await this.resolveCommands(res);
            }
        }
        return res;
    }
}