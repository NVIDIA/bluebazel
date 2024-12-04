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
import { languageMapping as bazelRuleTypeLanguageMapping, sortedBazelRuleTypePrefixes } from './bazel-rule-language-mapping';
import { ConfigurationManager } from './configuration-manager';
import { Console } from './console';
import { ShellService } from './shell-service';
import { cleanAndFormat } from './string-utils';
import { WorkspaceService } from './workspace-service';
import { BazelAction, BazelTarget } from '../models/bazel-target';
import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
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
     * Fetches available targets for Bazel.
     */
    public async fetchAllTargets(cancellationToken?: vscode.CancellationToken): Promise<BazelTarget[]> {
        return this.fetchAllTargetsFromBuildFiles('.*', undefined, true, cancellationToken);
        // return this.fetchAllTargetsFromQuery(cancellationToken);
    }

    public async fetchAllTargetsFromQuery(cancellationToken?: vscode.CancellationToken): Promise<BazelTarget[]> {
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

    private static getBuildFileAwkParser(ruleTypeRegex = '.*', includeOutputPackages = false) {
        const escapedPattern = ruleTypeRegex.replace(/(["\\])/g, '\\$1');

        // Awk is really, really fast at parsing the BUILD file content and outputting what we need.
        const awkScript = `
            BEGIN {
                # Capture the current working directory
                cwdir = ENVIRON["PWD"]
                # Ensure it ends with a slash for proper prefix matching
                if (substr(cwdir, length(cwdir), 1) != "/") {
                    cwdir = cwdir "/"
                }
            }
            {
                # Remove comments from each line
                sub(/#.*/, "")
                # Accumulate content per file
                content[FILENAME] = content[FILENAME] " " $0
            }
            ENDFILE {
                # Initialize relative path as the full filename
                relpath = FILENAME

                # Remove the current working directory prefix if present
                if (substr(relpath, 1, length(cwdir)) == cwdir) {
                    relpath = substr(relpath, length(cwdir) + 1)
                }
                # Else, remove leading "./" if present
                else if (substr(relpath, 1, 2) == "./") {
                    relpath = substr(relpath, 3)
                }
                # Else, remove leading "/" if present (for absolute paths)
                else if (substr(relpath, 1, 1) == "/") {
                    relpath = substr(relpath, 2)
                }
                # Else, leave it as is (already relative)

                # Remove trailing "/BUILD" or "/BUILD.bazel"
                sub(/\\/?BUILD(\\.bazel)?$/, "", relpath)

                # Initialize a flag to check for test targets
                has_test = 0

                # Process the accumulated content for the current file
                while (match(content[FILENAME], /([a-zA-Z0-9_]+)\\s*\\([^)]*name\\s*=\\s*["'"'"']([a-zA-Z0-9_/.+=,@~-]+)["'"'"'][^)]*\\)/, arr)) {
                    type = arr[1]
                    name = arr[2]
                    if (type ~ /${escapedPattern}/) {
                        # Check if the current target is a test
                        if (type ~ /_test$/) {
                            has_test = 1
                        }
                        # Print in desired format: <relative_path>:<type>:<name>
                        print relpath ":" type ":" name
                    }
                    # Remove the matched part to find subsequent matches
                    content[FILENAME] = substr(content[FILENAME], RSTART + RLENGTH)
                }

                ${includeOutputPackages ? `
                # After processing all targets, print the package line
                if (has_test) {
                    # Print package_test line
                    print relpath ":package_test:..."
                } else {
                    # Print package_build line
                    print relpath ":package_build:..."
                }
                ` : ''}

                # Clear the content for the next file
                delete content[FILENAME]
            }
        `;
        return awkScript;
    }

    public async fetchAllTargetsFromBuildFiles(ruleTypeRegex = '.*',
        rootDir?: string,
        includeOutputPackages = false,
        cancellationToken?: vscode.CancellationToken): Promise<BazelTarget[]> {
        Console.info(`Fetching targets with rule type ${ruleTypeRegex} from Bazel BUILD files...`);

        // Determine the root directory
        rootDir = rootDir || WorkspaceService.getInstance().getWorkspaceFolder()?.uri.path;

        if (!rootDir) {
            Console.error('No workspace folder found.');
            return Promise.reject(new Error('No workspace folder found.'));
        }

        try {
            const awkScript = BazelService.getBuildFileAwkParser(ruleTypeRegex, includeOutputPackages);
            // Escape double quotes and backslashes for the shell command
            const escapedRootDir = rootDir.replace(/(["\\])/g, '\\$1');

            // Construct the shell command
            const command = `
            find "${escapedRootDir}" \\( -name BUILD -o -name BUILD.bazel \\) -type f -print0 | \\
            xargs -0 awk '
                ${awkScript}
            '`;

            // Execute the shell command
            const result = await this.shellService.runShellCommand(command, cancellationToken);

            // Split the output into lines and filter out empty lines
            const lines = result.stdout.split('\n').filter(line => line.trim() !== '');

            // Map each line to a BazelTarget object
            const targets = lines.map(line => {
                const [bazelPath, ruleType, targetName] = line.split(':');
                let label = targetName;
                let fullBazelPath = `//${bazelPath}:${targetName}`;
                if (targetName === '...') {
                    fullBazelPath =  `//${path.join(bazelPath, targetName)}`;
                    label = fullBazelPath;
                }
                // Handle regular targets
                const buildPath = path.join(BAZEL_BIN, ...bazelPath.split('/'), targetName || '');
                return {
                    label: label,
                    ruleType: ruleType,
                    bazelPath: fullBazelPath,
                    buildPath: buildPath,
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
     * Fetch matching Bazel targets from a BUILD file.
     * @param filePath - The path to the BUILD or BUILD.bazel file.
     * @param kindPattern - Regex to match the rule type (e.g., .*_binary).
     * @param targetPrefix - Prefix to match the target name.
     * @returns List of target names matching the kindPattern and targetPrefix.
     */
    public static fetchMatchingTargets(filePath: string, kindPattern: string, targetPrefix: string): string[] {
        // Read the content of the file
        let content = fs.readFileSync(filePath, 'utf-8');

        // Step 1: Remove comments
        content = content.replace(/#.*$/gm, '');

        // Step 2: Replace newlines with spaces
        content = content.replace(/\n/g, ' ');

        // Step 3: Extract all rule types and target names
        const targetRegex = /([a-zA-Z0-9_]+)\s*\(\s*(?:[^)]*\s+)?name\s*=\s*['"]([a-zA-Z0-9_/.+=,@~-]+)['"]/g;
        const extractedTargets: { type: string; name: string }[] = [];
        let match;
        while ((match = targetRegex.exec(content)) !== null) {
            extractedTargets.push({ type: match[1], name: match[2] });
        }

        // Step 4: Filter based on kind pattern and target prefix
        const kindRegex = new RegExp(`^type:${kindPattern}`);
        return extractedTargets
            .filter((t) => kindRegex.test(`type:${t.type}`) && t.name.startsWith(targetPrefix))
            .map((t) => t.name);
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
        if (!ruleType || typeof ruleType !== 'string') {
            console.warn(`Invalid ruleType: ${ruleType}`);
            return undefined;
        }

        // Normalize the ruleType to lowercase to handle case-insensitive matching
        const normalizedRuleType = ruleType.toLowerCase();

        // Iterate over the sorted prefixes to find the first matching prefix
        for (const prefix of sortedBazelRuleTypePrefixes) {
            if (normalizedRuleType.includes(prefix)) {
                return bazelRuleTypeLanguageMapping.get(prefix);
            }
        }

        // Special cases or rules that don't map directly to a language
        if (normalizedRuleType.includes('package')) {
            return 'starlark';
        }

        // Return 'unknown' if no matching language is found
        return 'unknown';
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

    public async getRunfilesLocation(target: BazelTarget, cancellationToken?: vscode.CancellationToken): Promise<string> {
        try {
            const executable = this.configurationManager.getExecutableCommand();

            // Create a temporary file for the script path
            const tmpFile = tmp.fileSync();
            const tmpFilePath = tmpFile.name;

            // Run the Bazel command and extract the runfiles location
            const command = `${executable} run ${target.bazelPath} --script_path=${tmpFilePath} && grep -oP "(?<=cd ).*\\.runfiles" ${tmpFilePath}`;
            const data = await this.shellService.runShellCommand(command, cancellationToken);

            // Clean up the temporary file
            tmpFile.removeCallback();

            // Return the runfiles location
            return data.stdout.trim();
        } catch (error) {
            Console.error('Error getting runfiles location', error);
            return Promise.reject(error);
        }
    }

}
