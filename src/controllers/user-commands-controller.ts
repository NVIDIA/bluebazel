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
import { BazelTargetManager } from '../models/bazel-target-manager';
import { BazelService } from '../services/bazel-service';
import { ConfigurationManager } from '../services/configuration-manager';
import { ShellService } from '../services/shell-service';
import { TaskService } from '../services/task-service';
import * as vscode from 'vscode';


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
        private readonly bazelTargetManager: BazelTargetManager
    ) { }

    public async runCustomTask(command: string): Promise<void> {
        let completeCommand = this.resolveKeywords(command);
        try {
            completeCommand = await this.resolveExtensionCommands(completeCommand);
            completeCommand = await this.resolveCommands(completeCommand);
            this.taskService.runTask(`${completeCommand}`, completeCommand, completeCommand, this.configurationManager.isClearTerminalBeforeAction());
        } catch (error) {
            vscode.window.showErrorMessage(`Error running custom task: ${error}`);
        }
    }

    private static formatTestArgs(testArgs: string): string {
        const value = testArgs;
        const pattern = /(--\S+)/g;
        const result = value.replace(pattern, '--test_arg $1');
        return result;
    }
    private resolveKeyword(keyword: string): string {
        const buildTarget = this.bazelTargetManager.getSelectedTarget('build');
        const runTarget = this.bazelTargetManager.getSelectedTarget('run');
        const testTarget = this.bazelTargetManager.getSelectedTarget('test');


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
        try {
            // Evaluate the inner command of the pick
            const output = await this.resolveCommands(input);
            // Make a list of the output
            const outputList = [];
            for (const element of output.split('\n')) {
                const elementTrimmed = element.trim();
                if (elementTrimmed.length > 0) outputList.push(elementTrimmed);
            }

            await vscode.window.showQuickPick(outputList, { 'ignoreFocusOut': true }).then(data => {
                if (data !== undefined)
                    return data;
            });
            return '';
        } catch (error) {
            return Promise.reject(error);
        }
    }

    private async resolveExtensionCommands(input: string): Promise<string> {
        // Execute commands
        let output = input;
        const regexp = /\[([^\s]*)\(([^\s]*)\)\]/g;
        let match;
        try {
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
                            { value: extArgs }
                        ).then((val) => {
                            if (val !== undefined) {
                                evalRes = val;
                            }
                        });
                    }
                    output = output.replace(match[0], evalRes);
                }
            } while (match);
        } catch (error) {
            return Promise.reject(error);
        }
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
                try {
                    const currentCommand = await this.resolveCommandByKeyword(match[1]);
                    const evalRes = await this.shellService.runShellCommand(currentCommand);

                    output = output.replace(match[0], evalRes.stdout);
                } catch (error) {
                    return Promise.reject(error);
                }
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
                try {
                    res = await this.resolveExtensionCommands(res);
                    res = await this.resolveCommands(res);
                } catch (error) {
                    return Promise.reject(error);
                }
            }
        }
        return res;
    }
}