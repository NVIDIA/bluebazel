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
import { ConfigurationManager } from './configuration-manager';
import { Console } from './console';
import { ShellService } from './shell-service';
import { WorkspaceService } from './workspace-service';
import { BazelAction, BazelTarget } from '../models/bazel-target';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export const BAZEL_BIN = 'bazel-bin';

export class BazelService {

    constructor(
        private readonly configurationManager: ConfigurationManager,
        private readonly shellService: ShellService
    ) { }

    /**
     * Fetches the list of Bazel actions that require a target.
     */
    public async fetchBazelTargetActions(): Promise<string[]> {
        const actionsRequiringTarget: string[] = [
            'aquery',
            'build',
            'coverage',
            'cquery',
            'mobile-install',
            'print_action',
            'query',
            'run',
            'test'
        ];
        return actionsRequiringTarget;
    }

    /**
     * Gets the Bazel build path for the given target.
     */
    public async getBazelTargetBuildPath(target: BazelTarget, cancellationToken?: vscode.CancellationToken): Promise<string> {
        try {
            const bazelTarget = BazelService.formatBazelTargetFromPath(target.detail);
            const executable = this.configurationManager.getExecutableCommand();
            const configs = target.getConfigArgs();
            const cmd = `cquery ${configs} --output=starlark --starlark:expr=target.files_to_run.executable.path`;

            const result = await this.shellService.runShellCommand(`${executable} ${cmd} ${bazelTarget}`, cancellationToken);
            return result.stdout;
        } catch (error) {
            Console.error('Error fetching Bazel target build path:', error);
            return Promise.reject(error);  // Rejecting instead of throwing
        }
    }

    /**
     * Converts the provided path into a valid Bazel target path.
     */
    public static formatBazelTargetFromPath(path: string): string {
        const resultSplitted = path.split('/');
        resultSplitted.shift(); // Removes bazel-bin
        const targetName = resultSplitted[resultSplitted.length - 1];
        return '//' + resultSplitted.slice(0, resultSplitted.length - 1).join('/') + ':' + targetName;
    }

    /**
     * Fetches available run targets for Bazel.
     */
    public async fetchRunTargets(cancellationToken?: vscode.CancellationToken): Promise<{ label: string, detail: string }[]> {
        try {
            const executable = this.configurationManager.getExecutableCommand();
            const cmd = this.configurationManager.getGenerateRunTargetsCommand();

            const data = await this.shellService.runShellCommand(`${executable} ${cmd}`, cancellationToken);
            const allOutputs = data.stdout.split('\n');

            const targets = allOutputs
                .filter(element => element.length >= 2 && element.startsWith('//'))
                .map(element => {
                    const [targetPath, targetName] = element.split(':');
                    if (targetName) {
                        return {
                            label: targetName,
                            detail: path.join(BAZEL_BIN, ...targetPath.split('/'), targetName)
                        };
                    }
                    return { label: '', detail: '' };
                })
                .filter(target => target.label !== '');

            // Sort the targets alphabetically
            targets.sort((a, b) => (a.label < b.label ? -1 : 1));

            return targets;
        } catch (error) {
            Console.error('Error fetching run targets:', error);
            return Promise.reject(error);  // Rejecting instead of throwing
        }
    }

    /**
     * Searches for bash-completion scripts (e.g., for Bazel) in the specified directory.
     */
    private async findBashCompleteScript(startDir: string, cancellationToken?: vscode.CancellationToken): Promise<string | undefined> {
        const possibleFiles = ['bash-complete.*sh', 'bazel-complete.*sh'];

        for (const file of possibleFiles) {
            try {
                const result = await this.shellService.runShellCommand(`find ${startDir} -name "${file}"`, cancellationToken);

                if (result.stdout) {
                    const foundFile = result.stdout.trim();
                    if (foundFile) {
                        return foundFile;
                    }
                }
            } catch (error) {
                Console.error(`Error finding bash complete script for ${file}:`, error);
                return Promise.reject(error);  // Rejecting instead of throwing
            }
        }

        return undefined;
    }

    /**
     * Fetches available arguments or configs for a given Bazel action by sourcing bash-completion scripts.
     */
    private async fetchAutocompleteForAction(
        action: BazelAction,
        expandType: 'args' | 'configs',
        cancellationToken?: vscode.CancellationToken
    ): Promise<string[]> {
        try {
            const workspacePath = WorkspaceService.getInstance().getWorkspaceFolder().uri.path;
            const bashCompleteScript = await this.findBashCompleteScript(workspacePath, cancellationToken);

            if (!bashCompleteScript) {
                Console.warn(`Cannot find bash-complete.bash or bazel-complete.bash to receive available ${expandType}.`);
                return [];
            }

            const expandCommand = expandType === 'args'
                ? `_bazel__options_for ${action}`
                : `_bazel__expand_config . ${action}`;

            const data = await this.shellService.runShellCommand(
                `bash -c 'source ${bashCompleteScript} && echo $(${expandCommand})'`,
                cancellationToken
            );
            const result = data.stdout.split(' ');

            // Remove duplicates by converting the result to a set
            return Array.from(new Set(result));
        } catch (error) {
            Console.error(`Error fetching autocomplete for ${action} (${expandType}):`, error);
            return Promise.reject(error);  // Rejecting instead of throwing
        }
    }

    /**
     * Fetches available arguments for a given Bazel action.
     */
    public async fetchArgsForAction(action: BazelAction, cancellationToken: vscode.CancellationToken): Promise<string[]> {
        return this.fetchAutocompleteForAction(action, 'args', cancellationToken);
    }

    /**
     * Fetches available configs for a given Bazel action.
     */
    public async fetchConfigsForAction(action: BazelAction, cancellationToken: vscode.CancellationToken): Promise<string[]> {
        return this.fetchAutocompleteForAction(action, 'configs', cancellationToken);
    }

    /**
     * Fetches Bazel build targets from the specified directory.
     */
    public static async fetchBuildTargets(directoryPath: string, cwd: string): Promise<string[]> {
        const directory = path.join(cwd, directoryPath);
        const buildFilePaths = [path.join(directory, 'BUILD'), path.join(directory, 'BUILD.bazel')];

        // Iterate through the list of build file paths and resolve the first valid file
        for (const buildFilePath of buildFilePaths) {
            try {
                if (fs.existsSync(buildFilePath)) {
                    const data = await fs.promises.readFile(buildFilePath, 'utf8');
                    return BazelService.extractBuildTargetsFromFile(data);
                }
            } catch (error) {
                Console.error(`Error reading build file: ${buildFilePath}`, error);
                return Promise.reject(error);  // Rejecting instead of throwing
            }
        }

        return [];
    }

    /**
     * Extracts Bazel targets from the contents of a BUILD file.
     * This is a basic implementation; adjust the regex as needed for your use case.
     */
    private static extractBuildTargetsFromFile(buildFileContent: string): string[] {
        const targets: string[] = [];
        const targetRegex = /name\s*=\s*["']([^"']+)["']/g;
        let match;

        // Loop over all matches of the regex in the file content
        while ((match = targetRegex.exec(buildFileContent)) !== null) {
            targets.push(match[1]); // Capture the name of the target
        }

        return targets;
    }

    /**
     * Gets the programming language of the Bazel target based on its rule type.
     */
    public async fetchTargetLanguage(target: BazelTarget, cancellationToken?: vscode.CancellationToken): Promise<string> {
        try {
            const bazelTarget = BazelService.formatBazelTargetFromPath(target.detail);
            const executable = this.configurationManager.getExecutableCommand();

            const result = await this.shellService.runShellCommand(`${executable} query --output=label_kind ${bazelTarget}`, cancellationToken);
            const ruleType = result.stdout.toLowerCase();

            // Infer the programming language from the rule type
            if (ruleType.includes('go_')) {
                return 'go';
            } else if (ruleType.includes('py_')) {
                return 'python';
            } else if (ruleType.includes('cc_') || ruleType.includes('cpp_')) {
                return 'cpp';
            } else if (ruleType.includes('java_')) {
                return 'java';
            } else if (ruleType.includes('js_')) {
                return 'javascript';
            } else {
                return 'unknown';  // If no rule type matches
            }
        } catch (error) {
            Console.error('Error fetching target language:', error);
            return Promise.reject(error);  // Rejecting instead of throwing
        }
    }

}
