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
import { cleanAndFormat } from './string-utils';
import { WorkspaceService } from './workspace-service';
import { BazelAction, BazelTarget } from '../models/bazel-target';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export const BAZEL_BIN = 'bazel-bin';

export class BazelService {

    private readonly isBuildTargetRegex = /_library|_proto|_archive|_module|_object|_bundle|_package|_test|_build/;
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly shellService: ShellService
    ) { }

    /**
     * Fetches the list of Bazel actions that require a target.
     */
    public async fetchTargetActions(): Promise<string[]> {
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
            const bazelTarget = BazelService.formatBazelTargetFromPath(target.buildPath);
            const executable = this.configurationManager.getExecutableCommand();
            const configs = target.getConfigArgs().toString();
            const args = target.getBazelArgs().toString();
            const cmd = cleanAndFormat(
                'cquery',
                args,
                configs,
                '--output=starlark --starlark:expr=target.files_to_run.executable.path'
            );

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

    public async fetchAllTargetsByAction(cancellationToken?: vscode.CancellationToken, timeoutMs?: number): Promise<Map<BazelAction, BazelTarget[]>> {
        // Initialize map entries for each action
        const testTargets: BazelTarget[] = [];
        const map: Map<BazelAction, BazelTarget[]> = new Map([
            ['run', []],
            ['build', []],
            ['test', testTargets],
            ['coverage', testTargets]
        ]);

        try {
            // Fetch all targets
            // Race between the fetch operation and the timeout
            const fetchPromise = this.fetchAllTargets(cancellationToken);
            const targets = timeoutMs && timeoutMs !== 0 ? await Promise.race([
                fetchPromise,
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Update targets timed out')), timeoutMs)
                )
            ]) : await fetchPromise;

            // Iterate through fetched targets and categorize them by action
            targets.forEach(item => {
                const target = new BazelTarget(this.context, this, item.label, item.bazelPath, item.buildPath, '', item.ruleType);

                // Determine which categories this target belongs to
                if (target.ruleType.includes('_test')) {
                    map.get('test')?.push(target);
                    if (target.ruleType !== 'package_test') {
                        map.get('run')?.push(target); // Tests can also be run
                    }
                    map.get('build')?.push(target); // Tests are built before running
                } else if (target.ruleType.includes('_binary')) {
                    map.get('run')?.push(target);
                    map.get('build')?.push(target); // Binaries need to be built
                } else if (this.isBuildTargetRegex.test(target.ruleType)) {
                    map.get('build')?.push(target);
                }
            });

        } catch (error) {
            Console.error(`Failed to fetch and categorize targets: ${error}`);
            return Promise.reject(error);
        }

        return map;
    }


    private async runQuery(query: string, cancellationToken?: vscode.CancellationToken): Promise<{ stdout: string, stderr: string}> {
        try {
            const executable = this.configurationManager.getExecutableCommand();
            const data = await this.shellService.runShellCommand(`${executable} ${query}`, cancellationToken);
            Console.info('running query', `${executable} ${query}`);
            return data;
        } catch (error) {
            Console.error('Error running query', query, error);
            return Promise.reject(error);
        }
    }

    /**
     * Fetches available run targets for Bazel.
     */
    public async fetchAllTargets(cancellationToken?: vscode.CancellationToken): Promise<BazelTarget[]> {
        Console.info('Fetching all targets from bazel...');
        try {
            const filter = '"^(?!.*\\.aspect_rules_js|.*node_modules|.*bazel-|.*/\\.).*$"';
            // Run label_kind and package queries in parallel to save time
            const [targetsQuery, buildPackagesQuery, testPackagesQuery] = await Promise.all([
                this.runQuery(
                    `query 'filter(${filter}, kind(".*(${this.isBuildTargetRegex.source}|_binary|_test)", //...)
                    )' --output=label_kind --keep_going 2>/dev/null || true`,
                    cancellationToken),
                this.runQuery(`query 'filter(${filter}, //...)' --output=package --keep_going 2>/dev/null || true`, cancellationToken),
                this.runQuery(`query 'filter(${filter}, tests(//...))' --output=package --keep_going 2>/dev/null || true`, cancellationToken)
            ]);

            const targetOutputs = targetsQuery.stdout.split('\n');
            const buildPackagesOutputs = buildPackagesQuery.stdout.split('\n');
            const testPackagesOutputs = new Set(testPackagesQuery.stdout.split('\n'));

            // Combine build and test package information
            const unifiedPackages = buildPackagesOutputs.map(pkg =>
                testPackagesOutputs.has(pkg) ? `package_test package //${pkg}/...` : `package_build package //${pkg}/...`
            );
            unifiedPackages.push('package_test package //...');


            targetOutputs.push(...unifiedPackages);

            // Process target outputs to extract necessary fields and filter out empty labels in one pass
            const targets = targetOutputs
                .filter(line => line.trim() !== '')
                .map(line => {
                    const [ruleType, , target] = line.split(' ');
                    const [targetPath, targetName] = target.split(':');
                    const buildPath = path.join(BAZEL_BIN, ...targetPath.split('/'), targetName || '');
                    if (targetPath.includes('...')) {
                        (() => {
                            return;
                        })();
                        buildPath.split('/');
                    }
                    return {
                        label: targetName || targetPath,
                        ruleType: ruleType,
                        bazelPath: target,
                        buildPath: buildPath
                    } as BazelTarget;
                });

            // Sort the targets alphabetically
            return targets.sort((a, b) => (a.bazelPath < b.bazelPath ? -1 : 1));
        } catch (error) {
            Console.error('Error fetching run targets:', error);
            return Promise.reject(error);
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

    public static inferLanguageFromRuleType(ruleType: string): string | undefined {
        // Check for Go-related rules
        if (ruleType.includes('go_')) {
            return 'go';
        }

        // Check for Python-related rules
        if (ruleType.includes('py_')) {
            return 'python';
        }

        // Check for C++-related rules
        if (ruleType.includes('cc_') || ruleType.includes('cpp_')) {
            return 'cpp';
        }

        // Check for Java-related rules
        if (ruleType.includes('java_')) {
            return 'java';
        }

        // Check for JavaScript-related rules
        if (ruleType.includes('js_')) {
            return 'javascript';
        }

        // Check for Typescript-related rules
        if (ruleType.includes('ts_')) {
            return 'typescript';
        }

        // Check for Scala-related rules
        if (ruleType.includes('scala_')) {
            return 'scala';
        }

        // Check for Proto-related rules
        if (ruleType.includes('proto_')) {
            return 'proto';
        }

        // Check for Sh-related rules
        if (ruleType.includes('sh_')) {
            return 'bash';
        }

        // Check for Proto-related rules
        if (ruleType.includes('json_')) {
            return 'json';
        }

        if (ruleType.includes('package')) {
            return undefined;
        }

        return 'unknown';  // Default case if no known rule types are found
    }

    /**
     * Extracts the Bazel target from a source file path.
     * Dynamically determines the target name by inspecting the BUILD file.
     * @param sourceFilePath - The full path to the test file.
     * @returns The Bazel target as a string, or throws an error if extraction fails.
     */
    public static extractBazelTargetsAssociatedWithSourceFile(sourceFilePath: string): BazelTarget[] {
        // Get the directory of the current file
        const dir = path.dirname(sourceFilePath);

        // Find the Bazel workspace root
        const workspacePath = this.findWorkspaceRoot(dir);
        if (!workspacePath) {
            throw new Error('Could not find Bazel workspace');
        }

        // Compute the relative path to the package within the workspace
        const relativePath = path.relative(workspacePath, dir);
        if (!relativePath) {
            throw new Error('Could not compute relative path');
        }

        // Find the test target in the BUILD file
        const targetNames = this.getTargetsFromBuildFile(dir, sourceFilePath);
        if (!targetNames) {
            throw new Error('Could not find any targets in the BUILD file');
        }

        // Build the full Bazel target
        return targetNames.map((target) => {
            return {
                label: target.targetName,
                ruleType: target.ruleType,
                bazelPath: `//${relativePath}:${target.targetName}`,
                buildPath: path.join(BAZEL_BIN, ...relativePath.split('/'), target.targetName || '')
            } as BazelTarget;
        });
    }

    /**
     * Finds the Bazel workspace root by searching for the `WORKSPACE` file.
     * @param currentDir - The directory to start searching from.
     * @returns The Bazel workspace root path as a string, or null if not found.
     */
    private static findWorkspaceRoot(currentDir: string): string | null {
        let dir = currentDir;

        const forever = true;
        while (forever) {
            if (fs.existsSync(path.join(dir, 'WORKSPACE'))) {
                return dir;
            }

            const parentDir = path.dirname(dir);
            if (parentDir === dir) {
                // Reached the root directory
                return null;
            }

            dir = parentDir;
        }
        return null;
    }

    /**
     * Parses the BUILD file in the given directory to find all targets that include the specified file in their sources.
     * Extracts both the Bazel rule type and the target name.
     * @param dir - The directory containing the BUILD file.
     * @param filePath - The full path to the file whose targets we want to find.
     * @returns An array of objects with `ruleType` and `targetName`, or an empty array if no matching targets are found.
     */
    private static getTargetsFromBuildFile(dir: string, filePath: string): { ruleType: string; targetName: string }[] {
        const buildFileNames = ['BUILD', 'BUILD.bazel'];
        let buildFilePath: string | null = null;

        // Find the BUILD file in the directory
        for (const buildFileName of buildFileNames) {
            const candidatePath = path.join(dir, buildFileName);
            if (fs.existsSync(candidatePath)) {
                buildFilePath = candidatePath;
                break;
            }
        }

        if (!buildFilePath) {
            return []; // No BUILD file found
        }

        // Read the BUILD file content
        const buildFileContent = fs.readFileSync(buildFilePath, 'utf8');
        const fileName = path.basename(filePath);

        // Updated regex to capture rule type, target name, and `srcs` attribute content
        const regex = new RegExp(
            '(\\w+)\\s*\\(\\s*name\\s*=\\s*"(.*?)".*?srcs\\s*=\\s*\\[([^\\]]*?)\\]',
            'gs'
        );

        const matches: { ruleType: string; targetName: string }[] = [];
        let match;

        while ((match = regex.exec(buildFileContent)) !== null) {
            const ruleType = match[1]; // The type of the Bazel rule (e.g., go_test)
            const targetName = match[2]; // The name of the target
            const srcsContent = match[3]; // The content of the `srcs` attribute

            // Check if the file name is in the `srcs` list
            const srcRegex = new RegExp(`["']${fileName}["']`);
            if (srcRegex.test(srcsContent)) {
                matches.push({ ruleType, targetName });
            }
        }

        return matches; // Return all matching rule types and target names
    }

}
