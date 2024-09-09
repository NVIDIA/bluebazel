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

import { ConfigurationManager } from './configuration-manager';
import { ShellService } from './shell-service';
import { WorkspaceService } from './workspace-service';
import { BazelTarget } from '../models/bazel-target';
import * as fs from 'fs';
import * as path from 'path';


export const BAZEL_BIN = 'bazel-bin';

export class BazelService {

    constructor(private readonly configurationManager: ConfigurationManager,
        private readonly shellService: ShellService
    ) { }

    /**
     * Fetches the list of available Bazel commands.
     * @returns A promise that resolves to an array of command strings.
     */
    public async fetchBazelActions(): Promise<string[]> {
        const executable = this.configurationManager.getExecutableCommand();
        const result = await this.shellService.runShellCommand(`${executable} help | sed -n '/Available commands:/,/^$/pf' | tail -n +2 | awk '{print $1}' | sed '/^$/d'`, false);
        const lines = result.stdout.split('\n');
        const actions = lines.filter(line => line.startsWith('  ')).map(line => line.trim().split(' ')[0]);
        return actions;
    }

    public async getBazelTargetBuildPath(target: BazelTarget): Promise<string> {
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.detail);
        const executable = this.configurationManager.getExecutableCommand();
        const configs = target.getConfigArgs();
        const cmd = `cquery ${configs} --output=starlark --starlark:expr=target.files_to_run.executable.path`;

        const result = await this.shellService.runShellCommand(`${executable} ${cmd} ${bazelTarget}`, false);
        return result.stdout;
    }

    public static formatBazelTargetFromPath(path: string): string {
        const result = path;
        const resultSplitted = result.split('/');
        resultSplitted.shift(); // Removes bazel-bin
        const targetName = resultSplitted[resultSplitted.length - 1];
        return '//' + resultSplitted.slice(0, resultSplitted.length - 1).join('/') + ':' + targetName;
    }

    public async fetchRunTargets(): Promise<{label: string, detail: string}[]> {
        const executable = this.configurationManager.getExecutableCommand();
        const cmd = this.configurationManager.getGenerateRunTargetsCommand();

        const data = await this.shellService.runShellCommand(`${executable} ${cmd}`, false);
        const allOutputs = data.stdout.split('\n');

        const targets: {label: string, detail: string}[] = allOutputs
            .filter(element => element.length >= 2 && element.startsWith('//'))
            .map(element => {
                const [targetPath, targetName] = element.split(':');
                if (targetName) {
                    return {
                        label: targetName,
                        detail: path.join(BAZEL_BIN, ...targetPath.split('/'), targetName)
                    };
                }
                return {label: '', detail: ''};
            })
            .filter(target => target.label !== '');

        // Sort the targets alphabetically
        targets.sort((a: {label: string, detail: string}, b: {label: string, detail: string}) => { return a.label < b.label ? -1 : 1; });
        return targets;
    }

    public async fetchConfigsForAction(action: 'build' | 'run' | 'test' | 'query'): Promise<string[]> {
        // Check if bazel-complete.bash exists
        const bash_complete_script = path.join(WorkspaceService.getInstance().getWorkspaceFolder().uri.path, '3rdparty', 'bazel', 'bazel', 'bazel-complete.bash');
        const does_path_exist = fs.existsSync(bash_complete_script);
        if (!does_path_exist) {
            console.warn(`Cannot find ${bash_complete_script} to receive available configurations.`);
            return [];
        }
        else {
            // Get configs from bazel commands on shell for both run and build.
            // Combine them, convert to set to remove duplicates and back to list.
            const configs = await this.shellService.runShellCommand(`bash -c 'source ${bash_complete_script} && echo $(_bazel__expand_config . ${action})'`, false).then(data => { return data.stdout.split(' '); });
            const config_set = new Set(configs);
            return Array.from(config_set.values());
        }
    }

    /**
     * Method to get Bazel build targets from a directory
     * This assumes targets are defined in BUILD files.
     */
    public static async fetchBuildTargets(directoryPath: string, cwd: string): Promise<string[]> {
        const directory = path.join(cwd, directoryPath);
        const buildFilePaths = [path.join(directory, 'BUILD'), path.join(directory, 'BUILD.bazel')];

        // Iterate through the list of build file paths and resolve the first valid file
        for (const buildFilePath of buildFilePaths) {
            try {
                // Check if the file exists asynchronously
                if (fs.existsSync(buildFilePath)) {
                    // Read the file asynchronously using promises
                    const data = await fs.promises.readFile(buildFilePath, 'utf8');

                    // Extract targets from the BUILD file
                    const targets = BazelService.extractBuildTargetsFromFile(data);

                    return targets; // Resolve with the extracted targets
                }
            } catch (err) {
                console.error(`Error reading build file: ${buildFilePath}`, err);
                throw err; // Re-throw the error to propagate it up the call chain
            }
        }

        // If no valid BUILD or BUILD.bazel file was found, return an empty array
        return [];
    }

    /**
     * Helper method to extract Bazel targets from the contents of a BUILD file
     * This is a simplistic implementation. You can adjust it based on how targets are defined.
     */
    private static extractBuildTargetsFromFile(buildFileContent: string): string[] {
        const targets: string[] = [];

        // This is a basic regex pattern to match Bazel targets in the BUILD file
        const targetRegex = /name\s*=\s*["']([^"']+)["']/g;
        let match;

        // Loop over all matches of the regex in the file content
        while ((match = targetRegex.exec(buildFileContent)) !== null) {
            targets.push(match[1]); // Capture the name of the target
        }

        return targets;
    }


}