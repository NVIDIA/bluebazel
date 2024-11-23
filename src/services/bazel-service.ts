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

    public async fetchAllTargetsByAction(cancellationToken?: vscode.CancellationToken): Promise<Map<BazelAction, BazelTarget[]>> {
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
            const targets = await this.fetchAllTargets(cancellationToken);

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
    public async fetchAllTargets(cancellationToken?: vscode.CancellationToken): Promise<{ label: string, ruleType: string, bazelPath: string, buildPath: string }[]> {
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

    public static async fetchTargetsFromPathRecursively(rootDirectoryPath: string, cwd: string, targetTypes: string[]): Promise<{ name: string, ruleType: string, bazelPath: string }[]> {
        const targets: { name: string, ruleType: string, bazelPath: string }[] = [];

        async function traverse(directoryPath: string) {
            const directory = path.join(cwd, directoryPath);

            let entries: fs.Dirent[];
            try {
                entries = await fs.promises.readdir(directory, { withFileTypes: true });
            } catch (error) {
                Console.error(`Error reading directory: ${directory}`, error);
                return;
            }

            // Collect all promises for fetching targets and traversing subdirectories
            const subdirPromises: Promise<void>[] = [];

            try {
                // Fetch targets from the current directory
                const dirTargetsPromise = BazelService.fetchTargetsFromPath(directoryPath, cwd, targetTypes);
                const dirTargets = await dirTargetsPromise;
                targets.push(...dirTargets);
            } catch (error) {
                Console.error(`Error fetching targets from: ${directoryPath}`, error);
            }

            // Traverse subdirectories in parallel
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // Skip Bazel output directories and hidden directories
                    if (['bazel-bin', 'bazel-out', 'bazel-testlogs', 'node_modules', '.git'].includes(entry.name)) {
                        continue;
                    }
                    const subdirPath = path.join(directoryPath, entry.name);
                    subdirPromises.push(traverse(subdirPath)); // Queue subdirectory traversal in parallel
                }
            }

            // Wait for all subdirectory traversals to complete
            await Promise.all(subdirPromises);
        }

        await traverse(rootDirectoryPath);
        return targets;
    }


    public static async fetchTargetsFromPath(directoryPath: string, cwd: string, targetTypes: string[]): Promise<{ name: string, ruleType: string, bazelPath: string }[]> {
        const directory = path.join(cwd, directoryPath);
        const buildFilePaths = [path.join(directory, 'BUILD'), path.join(directory, 'BUILD.bazel')];

        for (const buildFilePath of buildFilePaths) {
            try {
                // Using fs.promises.stat to check file existence asynchronously
                await fs.promises.stat(buildFilePath);
                const data = await fs.promises.readFile(buildFilePath, 'utf8');
                return BazelService.extractTargetsFromFile(data, targetTypes, directoryPath);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {  // Ignore if file does not exist
                    Console.error(`Error reading build file: ${buildFilePath}`, error);
                    return Promise.reject(error);
                }
            }
        }

        return [];
    }

    public static async fetchTargetsFromPaths(directoryPaths: string[], cwd: string, targetTypes: string[]): Promise<{ name: string, ruleType: string, bazelPath: string }[]> {
        const targetPromises = directoryPaths.map(directoryPath =>
            BazelService.fetchTargetsFromPath(directoryPath, cwd, targetTypes)
        );

        const targetResults = await Promise.all(targetPromises);
        return targetResults.flat();  // Flatten the array of arrays
    }

    private static extractTargetsFromFile(buildFileContent: string, targetTypes: string[], directoryPath: string): { name: string, ruleType: string, bazelPath: string }[] {
        const targets: { name: string, ruleType: string, bazelPath: string }[] = [];

        // A more flexible regex to capture Bazel rules (ruleType(name=...)
        const targetRegex = /(\w+)\s*\(\s*((?:.|\n)*?)\)/g; // Match rule with its arguments (multi-line and complex)
        let match;

        while ((match = targetRegex.exec(buildFileContent)) !== null) {
            const ruleType = match[1]; // Capture rule type (e.g., go_binary, cc_library)
            const argsContent = match[2]; // Capture arguments inside the parentheses

            // Check if ruleType matches any in the targetTypes array or if targetTypes is empty (include all)
            if (targetTypes.length === 0 || targetTypes.includes(ruleType)) {
                // Find the name parameter within the arguments (ensure it is not commented out)
                const nameMatch = /name\s*=\s*["']([^"']+)["']/m.exec(argsContent);
                if (nameMatch) {
                    const targetName = nameMatch[1];
                    // Construct the fully qualified bazel path
                    const normalizedDir = directoryPath.replace(/\\/g, '/'); // Normalize Windows paths
                    const bazelPath = `//${normalizedDir}:${targetName}`;
                    targets.push({ name: targetName, ruleType, bazelPath });
                }
            }
        }

        return targets;
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
}
