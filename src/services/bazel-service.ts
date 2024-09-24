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
     * Extracts Bazel targets and their rule types from the contents of a BUILD file.
     */
    public static async fetchBuildTargets(directoryPath: string, cwd: string): Promise<{ name: string, ruleType: string }[]> {
        const directory = path.join(cwd, directoryPath);
        const buildFilePaths = [path.join(directory, 'BUILD'), path.join(directory, 'BUILD.bazel')];

        for (const buildFilePath of buildFilePaths) {
            try {
                if (fs.existsSync(buildFilePath)) {
                    const data = await fs.promises.readFile(buildFilePath, 'utf8');
                    return BazelService.extractBuildTargetsFromFile(data);
                }
            } catch (error) {
                Console.error(`Error reading build file: ${buildFilePath}`, error);
                return Promise.reject(error);
            }
        }

        return [];
    }

    /**
     * Wrapper to fetch only target names from the BUILD file.
     */
    public static async fetchBuildTargetNames(directoryPath: string, cwd: string): Promise<string[]> {
        try {
            // Call fetchBuildTargets to get both target names and rule types
            const buildTargets = await BazelService.fetchBuildTargets(directoryPath, cwd);

            // Extract and return only the target names as an array of strings
            return buildTargets.map(target => target.name);
        } catch (error) {
            Console.error('Error fetching target names:', error);
            return Promise.reject(error);
        }
    }

    /**
     * Extracts Bazel targets and their rule types from the BUILD file content.
     * This method uses a basic regex to capture both target names and rule types.
     */
    private static extractBuildTargetsFromFile(buildFileContent: string): { name: string, ruleType: string }[] {
        const targets: { name: string, ruleType: string }[] = [];
        const targetRegex = /(cc_|go_|py_|java_|js_)(\w+)\s*\(\s*name\s*=\s*["']([^"']+)["']/g;
        let match;

        // Loop over all matches of the regex in the file content
        while ((match = targetRegex.exec(buildFileContent)) !== null) {
            const ruleType = match[1] + match[2];  // Capture the rule type (e.g., go_library, py_binary)
            const targetName = match[3];  // Capture the target name
            targets.push({ name: targetName, ruleType });
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

    public async fetchTargetLanguageFromBuildFile(target: BazelTarget): Promise<string> {
        try {
            const buildPath = BazelService.formatBazelTargetFromPath(target.detail).split(':')[0];

            const dirBuildTargets = await BazelService.fetchBuildTargets(
                buildPath,
                WorkspaceService.getInstance().getWorkspaceFolder().uri.path
            );

            // Find the matching target by comparing the label with the fetched targets
            const matchedTarget = dirBuildTargets.find(t => t.name === target.label);

            if (!matchedTarget) {
                return 'unknown';  // If the target is not found, return unknown
            }

            // Infer the language from the rule type of the matched target
            return this.inferLanguageFromRuleType(matchedTarget.ruleType);

        } catch (error) {
            Console.error('Error fetching target language from BUILD file:', error);
            return Promise.reject(error);
        }
    }

    private inferLanguageFromRuleType(ruleType: string): string {
        // Check for Go-related rules
        if (ruleType.includes('go_library') || ruleType.includes('go_binary')) {
            return 'go';
        }

        // Check for Python-related rules
        if (ruleType.includes('py_library') || ruleType.includes('py_binary')) {
            return 'python';
        }

        // Check for C++-related rules
        if (ruleType.includes('cc_library') || ruleType.includes('cc_binary') || ruleType.includes('cpp_library')) {
            return 'cpp';
        }

        // Check for Java-related rules
        if (ruleType.includes('java_library') || ruleType.includes('java_binary')) {
            return 'java';
        }

        // Check for JavaScript-related rules
        if (ruleType.includes('js_library') || ruleType.includes('js_binary')) {
            return 'javascript';
        }

        return 'unknown';  // Default case if no known rule types are found
    }
}
