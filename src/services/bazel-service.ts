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
import * as path from 'path';
import { BazelTarget } from '../models/bazel-target';
import { ShellService } from './shell-service';
import { ConfigurationManager } from './configuration-manager';
import * as common from '../common';

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
        const bazelTarget = this.getBazelTarget(target.detail);
        const executable = this.configurationManager.getExecutableCommand();
        const configs = target.getConfigArgs();
        const cmd = `cquery ${configs} --output=starlark --starlark:expr=target.files_to_run.executable.path`;

        const result = await this.shellService.runShellCommand(`${executable} ${cmd} ${bazelTarget}`, false);
        return result.stdout;
    }

    private getBazelTarget(target: string): string {
        const result = target;
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
                        detail: path.join(common.BAZEL_BIN, ...targetPath.split('/'), targetName)
                    };
                }
                return {label: '', detail: ''};
            })
            .filter(target => target.label !== '');

        // Sort the targets alphabetically
        targets.sort((a: {label: string, detail: string}, b: {label: string, detail: string}) => { return a.label < b.label ? -1 : 1; });
        return targets;
    }

}