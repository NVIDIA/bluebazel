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
import { BazelTarget } from '../../models/bazel-target';
import { BazelService } from '../../services/bazel-service';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { LanguagePlugin } from '../language-plugin';
import * as path from 'path';
import * as vscode from 'vscode';


export class CppLanguagePlugin implements LanguagePlugin {
    public readonly supportedLanguages: string[];

    constructor(private readonly context: vscode.ExtensionContext,
        private readonly bazelService: BazelService,
        private readonly setupEnvVars: string[]
    ) {
        this.supportedLanguages = ['cpp', 'c'];
    }

    public getDebugRunUnderCommand(port: number): string {
        return `gdbserver :${port}`;
    }

    public getDebugEnvVars(_target: BazelTarget): string[] {
        return [];
    }

    public async createDebugRunUnderLaunchConfig(target: BazelTarget,
        _cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.buildPath);
        const bazelArgs = target.getBazelArgs().toString();
        const configArgs = target.getConfigArgs().toString();
        const workingDirectory = '${workspaceFolder}';
        const targetPath = target.buildPath;//await this.bazelService.getBazelTargetBuildPath(target, cancellationToken);
        const programPath = path.join(workingDirectory, targetPath);

        /* The environment key for type 'cppdbg' is different than
         * other launch configs because it expects an array of
         * objects that have a name key and value key in each object.
         * For example:
         * "environment": [
         *      {
         *          "name": "MY_ENV_VAR",
         *          "value": "my_value"
         *      },
         *      {
         *          "name": "ANOTHER_VAR",
         *          "value": "another_value"
         *      }
         */
        const envVars = EnvVarsUtils.listToArrayOfObjects(target.getEnvVars().toStringArray());
        const runArgs = target.getRunArgs().toString();

        const config = {
            name: `${bazelTarget} (Run Under)`,
            type: 'cppdbg',
            request: 'launch',
            program: '/bin/bash',
            args: ['-c', `./.vscode/bazel_debug.sh ${target.action} --run_under=gdb ${bazelArgs} ${configArgs} ${bazelTarget} ${runArgs}`],
            stopAtEntry: false,
            cwd: workingDirectory,
            sourceFileMap: { '/proc/self/cwd': workingDirectory },
            environment: [ ...EnvVarsUtils.listToArrayOfObjects(this.setupEnvVars), ...envVars ],
            externalConsole: false,
            targetArchitecture: 'x64',
            customLaunchSetupCommands: [
                { description: '', text: `-file-exec-and-symbols ${programPath}`, ignoreFailures: false }
            ],
            setupCommands: [{ description: 'Enable pretty-printing for gdb', text: '-enable-pretty-printing', ignoreFailures: true }],
            logging: { programOutput: true },
            internalConsoleOptions: 'openOnSessionStart'
        } as vscode.DebugConfiguration;
        return config;
    }

    public async createDebugDirectLaunchConfig(target: BazelTarget, _cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
        const workingDirectory = '${workspaceFolder}';
        const targetPath = target.buildPath;//await this.bazelService.getBazelTargetBuildPath(target, cancellationToken);
        const programPath = path.join(workingDirectory, targetPath);

        /* The environment key for type 'cppdbg' is different than
         * other launch configs because it expects an array of
         * objects that have a name key and value key in each object.
         * For example:
         * "environment": [
         *      {
         *          "name": "MY_ENV_VAR",
         *          "value": "my_value"
         *      },
         *      {
         *          "name": "ANOTHER_VAR",
         *          "value": "another_value"
         *      }
         */
        const envVars = EnvVarsUtils.listToArrayOfObjects(target.getEnvVars().toStringArray());
        const args = target.getRunArgs().toString();

        return {
            name: `${programPath} (Direct)`,
            type: 'cppdbg',
            request: 'launch',
            program: programPath,
            stopAtEntry: false,
            cwd: workingDirectory,
            environment: [...EnvVarsUtils.listToArrayOfObjects(this.setupEnvVars), ...envVars],
            externalConsole: false,
            MIMode: 'gdb',
            setupCommands: [{ description: 'Enable pretty-printing for gdb', text: '-enable-pretty-printing', ignoreFailures: true }],
            args: args.length > 0 ? args.split(' ') : []
        };
    }

    public async createDebugAttachConfig(target: BazelTarget,
        port: number,
        _cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.buildPath);
        const workingDirectory = '${workspaceFolder}';
        const targetPath = target.buildPath;//await this.bazelService.getBazelTargetBuildPath(target);
        const programPath = path.join(workingDirectory, targetPath);

        const envVars = EnvVarsUtils.listToArrayOfObjects(target.getEnvVars().toStringArray());

        const config = {
            name: `${bazelTarget} (Attach)`,
            type: 'cppdbg',
            // Oddly enough, gdb requires launch when attaching because
            // attach is reserved for process id...
            request: 'launch',
            program: programPath,
            miDebuggerServerAddress: `127.0.0.1:${port}`,
            miDebuggerPath: '/usr/bin/gdb',
            stopAtEntry: false,
            cwd: workingDirectory,
            sourceFileMap: { '/proc/self/cwd': workingDirectory },
            environment: [...EnvVarsUtils.listToArrayOfObjects(this.setupEnvVars), ...envVars],
            externalConsole: false,
            targetArchitecture: 'x64',
            customLaunchSetupCommands: [
                {
                    description: '',
                    text: `-file-exec-and-symbols ${programPath}`,
                    ignoreFailures: false
                }
            ],
            setupCommands: [
                {
                    description: 'Enable pretty-printing for gdb',
                    text: '-enable-pretty-printing',
                    ignoreFailures: true
                }
            ],
            logging: {
                programOutput: true
            },
            internalConsoleOptions: 'openOnSessionStart',
            useExtendedRemote: true,
        };
        return config;
    }

    /**
     * Regex to match test functions in C/C++.
     * Example matches:
     * TEST(TestSuite, TestName)
     * TEST_F(TestFixture, TestName)
     */
    public getCodeLensTestRegex(): RegExp {
        return /\b(?:TEST|TEST_F|TYPED_TEST|TYPED_TEST_P)\s*\(\s*([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)\s*\)/gm;
    }

    /**
     * Regex to match main function definitions in C/C++.
     * Example matches:
     * int main()
     * int main(int argc, char** argv)
     * int main(int argc, char* argv[])
     * void main()
     * void main(int argc, char** argv)
     * void main(int argc, char* argv[])
     * static int main(int argc, char* argv[])
     * static void main(int argc, char* argv[])
     */
    public getCodeLensRunRegex(): RegExp {
        return /\b(?:int|void)\s+(main)\s*\(\s*(?:int\s+\w+\s*,\s*char\s*\*\s*\w+\s*)?\s*\)/gm;
    }

}