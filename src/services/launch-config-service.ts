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

import { BAZEL_BIN, BazelService } from './bazel-service';
import { EnvVarsUtils } from './env-vars-utils';
import { BazelTarget } from '../models/bazel-target';
import * as path from 'path';
import * as vscode from 'vscode';


export class LaunchConfigService {
    constructor(context: vscode.ExtensionContext,
        private readonly bazelService: BazelService,
        private readonly setupEnvVars: string[]
    ) { }


    public async createRunUnderLaunchConfig(target: BazelTarget, cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
        switch (BazelService.inferLanguageFromRuleType(target.ruleType)) {
        case 'cpp':
            return await this.createCppRunUnderLaunchConfig(target, cancellationToken);
        case 'python':
            return await this.createPythonRunUnderLaunchConfig(target, cancellationToken);
        case 'go':
            return await this.createGoRunUnderLaunchConfig(target, cancellationToken);
        default:
            throw new Error(`Unsupported language for run under: ${target.ruleType}`);
        }
    }

    public async createDirectLaunchConfig(target: BazelTarget, cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
        switch (BazelService.inferLanguageFromRuleType(target.ruleType)) {
        case 'cpp':
            return await this.createCppDirectLaunchConfig(target, cancellationToken);
        case 'python':
            return await this.createPythonDirectLaunchConfig(target, cancellationToken);
        case 'go':
            return await this.createGoDirectLaunchConfig(target, cancellationToken);
        default:
            throw new Error(`Unsupported language for direct launch: ${target.ruleType}`);
        }
    }

    public async createLaunchConfigs(target: BazelTarget): Promise<vscode.DebugConfiguration[]> {
        const runUnderConfig = await this.createRunUnderLaunchConfig(target);
        const directConfig = await this.createDirectLaunchConfig(target);

        return [runUnderConfig, directConfig];
    }

    // C++ Run Under Bazel configuration (existing logic)
    private async createCppRunUnderLaunchConfig(target: BazelTarget, cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.buildPath);
        const bazelArgs = target.getBazelArgs().toString();
        const configArgs = target.getConfigArgs().toString();
        const workingDirectory = '${workspaceFolder}';
        const targetPath = await this.bazelService.getBazelTargetBuildPath(target, cancellationToken);
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
        };
        return config;
    }

    // C++ Direct Debug configuration
    private async createCppDirectLaunchConfig(target: BazelTarget, cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
        const workingDirectory = '${workspaceFolder}';
        const targetPath = await this.bazelService.getBazelTargetBuildPath(target, cancellationToken);
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

    // Python Run Under Bazel configuration
    private async createPythonRunUnderLaunchConfig(target: BazelTarget, cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
        return this.createPythonDirectLaunchConfig(target, cancellationToken);
    }

    // Python Direct Debug configuration
    private async createPythonDirectLaunchConfig(target: BazelTarget, cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
        const workingDirectory = '${workspaceFolder}';
        const pythonFile = `${workingDirectory}/${target.buildPath}`;
        const args = target.getRunArgs().toString();
        const envVars = EnvVarsUtils.listToObject(target.getEnvVars().toStringArray());
        // TODO: This may not always work and perhaps we need a way to
        // get the original python file from bazel.
        const originalPythonFile = path.normalize(pythonFile.replace(BAZEL_BIN, '')).concat('.py');
        return {
            name: `${pythonFile} (Direct)`,
            type: 'debugpy',
            request: 'launch',
            program: pythonFile,
            args: args.length > 0 ? args.split(' ') : [],
            pathMappings: [
                {
                    localRoot: originalPythonFile,
                    remoteRoot: pythonFile
                }
            ],
            stopOnEntry: false,
            cwd: workingDirectory,
            env: {...EnvVarsUtils.listToObject(this.setupEnvVars), ...envVars},
            console: 'integratedTerminal',
            justMyCode: true
        };
    }

    // Go Run Under Bazel configuration
    private async createGoRunUnderLaunchConfig(target: BazelTarget, cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
        return this.createGoDirectLaunchConfig(target, cancellationToken);
    }

    // Go Direct Debug configuration
    private async createGoDirectLaunchConfig(target: BazelTarget, cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
        const workingDirectory = '${workspaceFolder}';
        const targetPath = await this.bazelService.getBazelTargetBuildPath(target, cancellationToken);
        const programPath = path.join(workingDirectory, targetPath);
        const envVars = EnvVarsUtils.listToObject(target.getEnvVars().toStringArray());
        const args = target.getRunArgs().toString();

        return {
            name: `${targetPath} (Direct)`,
            type: 'go',
            request: 'launch',
            mode: 'exec',
            program: programPath,
            args: args.length > 0 ? args.split(' ') : [],
            stopOnEntry: false,
            cwd: workingDirectory,
            env: {...EnvVarsUtils.listToObject(this.setupEnvVars), ...envVars},
            console: 'integratedTerminal',
            substitutePath: [
                {
                    from: '${workspaceFolder}',
                    to: ''
                }
            ]
        };
    }

    public refreshLaunchConfigs(target: BazelTarget) {
        if (!target) return;

        this.createLaunchConfigs(target).then(launchConfigs => {
            const oldConfigs = vscode.workspace.getConfiguration('launch').get<vscode.DebugConfiguration[]>('configurations') || [];
            const newConfigs = oldConfigs.filter(config => !launchConfigs.some(newConfig => newConfig.name === config.name));

            newConfigs.push(...launchConfigs);

            vscode.workspace
                .getConfiguration('launch')
                .update('configurations', newConfigs, vscode.ConfigurationTarget.Workspace);
        });
    }
}