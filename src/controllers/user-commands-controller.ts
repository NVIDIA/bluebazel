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
import { ConfigurationManager, ShellCommand } from '../services/configuration-manager';
import { ShellService } from '../services/shell-service';
import { TaskService } from '../services/task-service';
import { showProgress } from '../ui/progress';
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

    private static EXTENSION_COMMANDS: Map<string, (resolver: any, extArgs: string) => string> = new Map([
        [ 'MultiPick', (resolver, extArgs) => resolver.extPickMany(extArgs) ],
        [ 'Pick', (resolver, extArgs) => resolver.extPick(extArgs) ],
        [ 'Input', (resolver, extArgs) => resolver.extInput(extArgs) ]
    ]);

    constructor(
        private readonly configurationManager: ConfigurationManager,
        private readonly shellService: ShellService, // Inject the services
        private readonly taskService: TaskService,
        private readonly bazelTargetManager: BazelTargetManager
    ) { }

    public async runCustomTask(command: string): Promise<void> {
        const resolver = new this.ResolverContext(this);
        let completeCommand = resolver.resolveKeywords(command);
        return showProgress(`Running ${completeCommand}`, async (cancellationToken) => {
            try {
                completeCommand = await resolver.resolveExtensionCommands(completeCommand);
                completeCommand = await resolver.resolveCommands(completeCommand);
                this.taskService.runTask(completeCommand, completeCommand, this.configurationManager.isClearTerminalBeforeAction(), cancellationToken);
            } catch (error) {
                vscode.window.showErrorMessage(`Error running custom task: ${error}`);
            } finally {

                resolver.cache.clear();
            }
        });
    }

    private static formatTestArgs(testArgs: string): string {
        const value = testArgs;
        const pattern = /(--\S+)/g;
        const result = value.replace(pattern, '--test_arg $1');
        return result;
    }

    private ResolverContext = class {
        public cache: Map<string, string> = new Map<string, string>();

        constructor(private controller: UserCommandsController) { }

        protected resolveKeyword(keyword: string): string {
            const buildTarget = this.controller.bazelTargetManager.getSelectedTarget('build');
            const runTarget = this.controller.bazelTargetManager.getSelectedTarget('run');
            const testTarget = this.controller.bazelTargetManager.getSelectedTarget('test');

            const keywordMap: Map<string, () => string> = new Map([
                [UserCommandsController.CONFIG_KEYWORDS.runArgs, () => runTarget.getRunArgs().toString()],
                [UserCommandsController.CONFIG_KEYWORDS.testArgs, () => UserCommandsController.formatTestArgs(testTarget.getRunArgs().toString())],
                [UserCommandsController.CONFIG_KEYWORDS.runTarget, () => {
                    return BazelService.formatBazelTargetFromPath(runTarget.buildPath);
                }],
                [UserCommandsController.CONFIG_KEYWORDS.testTarget, () => testTarget.buildPath],
                [UserCommandsController.CONFIG_KEYWORDS.buildConfigs, () => buildTarget.getConfigArgs().toString()],
                [UserCommandsController.CONFIG_KEYWORDS.runConfigs, () => runTarget.getConfigArgs().toString()],
                [UserCommandsController.CONFIG_KEYWORDS.testConfigs, () => testTarget.getConfigArgs().toString()],
                [UserCommandsController.CONFIG_KEYWORDS.bazelBuildArgs, () => buildTarget.getBazelArgs().toString()],
                [UserCommandsController.CONFIG_KEYWORDS.bazelRunArgs, () => runTarget.getBazelArgs().toString()],
                [UserCommandsController.CONFIG_KEYWORDS.bazelTestArgs, () => testTarget.getBazelArgs().toString()],
                [UserCommandsController.CONFIG_KEYWORDS.buildEnvVars, () => buildTarget.getEnvVars().toStringArray().join(' ')],
                [UserCommandsController.CONFIG_KEYWORDS.runEnvVars, () => runTarget.getEnvVars().toStringArray().join(' ')],
                [UserCommandsController.CONFIG_KEYWORDS.testEnvVars, () => buildTarget.getEnvVars().toStringArray().join(' ')],
                [UserCommandsController.CONFIG_KEYWORDS.buildTarget, () => testTarget.buildPath],
                [UserCommandsController.CONFIG_KEYWORDS.executable, () => this.controller.configurationManager.getExecutableCommand()],
                [UserCommandsController.CONFIG_KEYWORDS.formatCommand, () => this.controller.configurationManager.getFormatCommand()],
            ]);

            const getValue = keywordMap.get(keyword);
            return getValue ? getValue() : `\${${keyword}}`;
        }

        private async buildPickList(input: string): Promise<string[]> {
            // Evaluate the inner command of the pick
            const output = await this.resolveCommands(input);
            // Make a list of the output
            const outputList = [];
            for (const element of output.split('\n')) {
                const elementTrimmed = element.trim();
                if (elementTrimmed.length > 0) outputList.push(elementTrimmed);
            }
            return outputList;
        }

        private async extPick(input: string): Promise<string> {
            try {
                return vscode.window.showQuickPick(
                    this.buildPickList(input),
                    { 'ignoreFocusOut': true }
                ).then((data) => {
                    return data !== undefined ? data : ''
                });
            } catch (error) {
                return Promise.reject(error);
            }
        }

        private async extPickMany(input: string): Promise<string> {
            try {
                return vscode.window.showQuickPick(
                    this.buildPickList(input),
                    { 'ignoreFocusOut': true, 'canPickMany': true }
                ).then((data) => {
                    return data !== undefined ? data : []
                }).then((data) => {
                    data = data.map((item) => item.replace(/\n/g, "\\n"));
                    return data.join("\n");
                });
            } catch (error) {
                return Promise.reject(error);
            }
        }

        private async extInput(input: string): Promise<string> {
            try {
                let resolvedInput = await this.resolveCommands(input);
                if (resolvedInput !== undefined) {
                    // we take the first result if this is a multi-line string
                    resolvedInput = resolvedInput.split('\n')[0];
                }
                return vscode.window.showInputBox(
                    { value: resolvedInput }
                ).then((val) => {
                    return val !== undefined ? val : ''
                });
            } catch (error) {
                return Promise.reject(error);
            }
        }

        public async resolveExtensionCommands(input: string): Promise<string> {
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
                        const handler = UserCommandsController.EXTENSION_COMMANDS.get(extCommand);
                        if (handler !== undefined) {
                            evalRes = await handler(this, extArgs);
                        }
                        output = output.replace(match[0], evalRes);
                    }
                } while (match);
            } catch (error) {
                return Promise.reject(error);
            }
            return output;
        }

        public resolveKeywords(input: string): string {
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

        private findCommandByKeyword(keyword: string): ShellCommand | undefined {
            const commands = this.controller.configurationManager.getShellCommands();
            return commands.find((item) => item.name == keyword);
        }

        public async resolveCommands(input: string): Promise<string> {
            // Execute commands
            let output = input;
            const regexp = /<([^\s]*)>/g;
            let match;
            do {
                match = regexp.exec(input);
                if (match) {
                    try {
                        const cmd = this.findCommandByKeyword(match[1]);
                        let evalRes = '';
                        if (cmd !== undefined) {
                            if (cmd.memoized && this.cache.has(cmd.name)) {
                                evalRes = this.cache.get(cmd.name) ?? '';
                            } else {
                                const resolvedCmd = await this.resolveCommand(cmd.command);
                                const cmdRes = await this.controller.shellService.runShellCommand(resolvedCmd);
                                evalRes = cmdRes.stdout;
                                this.cache.set(cmd.name, evalRes);
                            }
                        }

                        output = output.replace(match[0], evalRes);
                    } catch (error) {
                        return Promise.reject(error);
                    }
                }
            } while (match);
            return output;
        }

        private async resolveCommand(command: string): Promise<string> {
            try {
                let res = this.resolveKeywords(command);
                res = await this.resolveExtensionCommands(res);
                res = await this.resolveCommands(res);
                return res;
            } catch (error) {
                return Promise.reject(error);
            }
        }
    }
}
