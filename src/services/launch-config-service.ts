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

import { BazelService } from './bazel-service';
import { EnvVarsUtils } from './env-vars-utils';
import { BazelTarget } from '../models/bazel-target';
import * as path from 'path';
import * as vscode from 'vscode';


export class LaunchConfigService {
    constructor(context: vscode.ExtensionContext,
        private readonly bazelService: BazelService,
        private readonly setupEnvVars: Array<{ [key: string]: string }>
    ) { }


    public async createRunUnderLaunchConfig(target: BazelTarget): Promise<vscode.DebugConfiguration> {
        const language = await target.getLanguage();  // Determine language from the target

        switch (language) {
        case 'cpp':
            return await this.createCppRunUnderLaunchConfig(target);
        case 'python':
            return await this.createPythonRunUnderLaunchConfig(target);
        case 'go':
            return await this.createGoRunUnderLaunchConfig(target);
        default:
            throw new Error(`Unsupported language for run under: ${language}`);
        }
    }

    public async createDirectLaunchConfig(target: BazelTarget): Promise<vscode.DebugConfiguration> {
        const language = await target.getLanguage();  // Determine language from the target

        switch (language) {
        case 'cpp':
            return await this.createCppDirectLaunchConfig(target);
        case 'python':
            return await this.createPythonDirectLaunchConfig(target);
        case 'go':
            return await this.createGoDirectLaunchConfig(target);
        default:
            throw new Error(`Unsupported language for direct launch: ${language}`);
        }
    }

    public async createLaunchConfigs(target: BazelTarget): Promise<vscode.DebugConfiguration[]> {
        const runUnderConfig = await this.createRunUnderLaunchConfig(target);
        const directConfig = await this.createDirectLaunchConfig(target);

        return [runUnderConfig, directConfig];
    }

    // C++ Run Under Bazel configuration (existing logic)
    private async createCppRunUnderLaunchConfig(target: BazelTarget): Promise<vscode.DebugConfiguration> {
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.detail);
        const bazelArgs = target.getBazelArgs().toString();
        const configArgs = target.getConfigArgs().toString();
        const workingDirectory = '${workspaceFolder}';
        const targetPath = await this.bazelService.getBazelTargetBuildPath(target);
        const programPath = path.join(workingDirectory, targetPath);
        const envVars = EnvVarsUtils.listToArrayOfObjects(target.getEnvVars().toStringArray());
        const runArgs = target.getRunArgs().toString();

        return {
            name: `${bazelTarget} (Run Under)`,
            type: 'cppdbg',
            request: 'launch',
            program: '/bin/bash',
            args: ['-c', `./.vscode/bazel_debug.sh run --run_under=gdb ${bazelArgs} ${configArgs} ${bazelTarget} ${runArgs}`],
            stopAtEntry: false,
            cwd: workingDirectory,
            sourceFileMap: { '/proc/self/cwd': workingDirectory },
            environment: [...this.setupEnvVars, ...envVars],
            externalConsole: false,
            targetArchitecture: 'x64',
            customLaunchSetupCommands: [
                { description: '', text: `-file-exec-and-symbols ${programPath}`, ignoreFailures: false }
            ],
            setupCommands: [{ description: 'Enable pretty-printing for gdb', text: '-enable-pretty-printing', ignoreFailures: true }],
            logging: { programOutput: true },
            internalConsoleOptions: 'openOnSessionStart'
        };
    }

    // C++ Direct Debug configuration
    private async createCppDirectLaunchConfig(target: BazelTarget): Promise<vscode.DebugConfiguration> {
        const workingDirectory = '${workspaceFolder}';
        const targetPath = await this.bazelService.getBazelTargetBuildPath(target);
        const programPath = path.join(workingDirectory, targetPath);
        const envVars = EnvVarsUtils.listToArrayOfObjects(target.getEnvVars().toStringArray());
        const args = target.getRunArgs().toString();

        return {
            name: `${programPath} (Direct)`,
            type: 'cppdbg',
            request: 'launch',
            program: programPath,
            stopAtEntry: false,
            cwd: workingDirectory,
            environment: [...this.setupEnvVars, ...envVars],
            externalConsole: false,
            MIMode: 'gdb',
            setupCommands: [{ description: 'Enable pretty-printing for gdb', text: '-enable-pretty-printing', ignoreFailures: true }],
            args: args.length > 0 ? args.split(' ') : []
        };
    }

    // Python Run Under Bazel configuration
    private async createPythonRunUnderLaunchConfig(target: BazelTarget): Promise<vscode.DebugConfiguration> {
        const workingDirectory = '${workspaceFolder}';
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.detail);
        const envVars = EnvVarsUtils.listToArrayOfObjects(target.getEnvVars().toStringArray());
        const args = target.getRunArgs().toString();  // Extract arguments for the Python program

        return {
            name: `${bazelTarget} (Run Under)`,
            type: 'python',  // Use 'python' for Python debugging
            request: 'launch',
            program: '/bin/bash',  // Run through the shell script like bazel_debug.sh
            args: ['-c', `./.vscode/bazel_debug.sh run ${bazelTarget} ${args}`],  // Pass Bazel target and args to the shell script
            stopOnEntry: false,
            cwd: workingDirectory,
            env: [...this.setupEnvVars, ...envVars],
            console: 'integratedTerminal',
            justMyCode: true
        };
    }

    // Python Direct Debug configuration
    private async createPythonDirectLaunchConfig(target: BazelTarget): Promise<vscode.DebugConfiguration> {
        const workingDirectory = '${workspaceFolder}';
        const pythonFile = `${workingDirectory}/${target.detail}`;
        const args = target.getRunArgs().toString();
        const envVars = EnvVarsUtils.listToArrayOfObjects(target.getEnvVars().toStringArray());

        return {
            name: `${pythonFile} (Direct)`,
            type: 'python',
            request: 'launch',
            program: pythonFile,
            args: args.length > 0 ? args.split(' ') : [],
            stopOnEntry: false,
            cwd: workingDirectory,
            env: [...this.setupEnvVars, ...envVars],
            console: 'integratedTerminal',
            justMyCode: true
        };
    }

    // Go Run Under Bazel configuration
    private async createGoRunUnderLaunchConfig(target: BazelTarget): Promise<vscode.DebugConfiguration> {
        return this.createGoDirectLaunchConfig(target);
    }

    // Go Direct Debug configuration
    private async createGoDirectLaunchConfig(target: BazelTarget): Promise<vscode.DebugConfiguration> {
        const workingDirectory = '${workspaceFolder}';
        const targetPath = await this.bazelService.getBazelTargetBuildPath(target);
        const programPath = path.join(workingDirectory, targetPath);
        const envVars = EnvVarsUtils.listToArrayOfObjects(target.getEnvVars().toStringArray());
        const args = target.getRunArgs().toString();

        return {
            name: `${programPath} (Direct)`,
            type: 'go',
            request: 'launch',
            mode: 'exec',
            program: programPath,
            args: args.length > 0 ? args.split(' ') : [],
            stopOnEntry: false,
            cwd: workingDirectory,
            env: [...this.setupEnvVars, ...envVars],
            console: 'integratedTerminal',
            substitutePath: [
                {
                    from: '${workspaceFolder}',
                    to: ''
                }
            ]
        };
    }
    // public async createRunUnderLaunchConfig(target: BazelTarget): Promise<vscode.DebugConfiguration> {
    //     const bazelTarget = BazelService.formatBazelTargetFromPath(target.detail);
    //     const args = target.getRunArgs().toString();
    //     const bazelArgs = target.getBazelArgs().toString();
    //     const configArgs = target.getConfigArgs().toString();
    //     const workingDirectory = '${workspaceFolder}';
    //     const targetPath = await this.bazelService.getBazelTargetBuildPath(target);

    //     // Program (executable) path with respect to workspace.
    //     const programPath = path.join(workingDirectory, targetPath);
    //     const envVars = EnvVarsUtils.listToArrayOfObjects(target.getEnvVars().toStringArray());
    //     const setupEnvVars = this.setupEnvVars;
    //     const bazelDebugProgram = `${'${workspaceFolder}'}/.vscode/bazel_debug.sh`;
    //     // This is a hacky approach to force debug in a container.
    //     const debugConf: vscode.DebugConfiguration = {
    //         name: `${bazelTarget}`,
    //         type: 'cppdbg',
    //         request: 'launch',
    //         program: '/bin/bash',
    //         args: ['-c', `${bazelDebugProgram} run --run_under=gdb`, bazelArgs, configArgs, bazelTarget],
    //         stopAtEntry: false,
    //         cwd: '${workspaceFolder}',
    //         sourceFileMap: {
    //             '/proc/self/cwd': '${workspaceFolder}', // This is important for breakpoints,
    //         },
    //         environment: [...setupEnvVars, ...envVars],
    //         externalConsole: false,
    //         targetArchitecture: 'x64', // Might we useful to change it based on target.
    //         // We need this to find the symbols inside bazel with respect to gdb's
    //         // starting point.
    //         customLaunchSetupCommands: [
    //             {
    //                 'description': '',
    //                 'text': `-file-exec-and-symbols ${programPath}`,
    //                 'ignoreFailures': false
    //             }
    //         ],
    //         setupCommands: [
    //             {
    //                 description: 'Enable pretty-printing for gdb',
    //                 text: '-enable-pretty-printing',
    //                 ignoreFailures: true
    //             }
    //         ],
    //         // Couldn't find a way to get the bazel output.
    //         logging: {
    //             programOutput: true
    //         },
    //         internalConsoleOptions: 'openOnSessionStart'
    //     };
    //     if (this.configurationManager.isDebugEngineLogging()) {
    //         debugConf.logging.engineLogging = true;
    //     }

    //     // Debugger does not accept an empty list as arguments
    //     if (args.length > 0) {
    //         debugConf.customLaunchSetupCommands.push(
    //             {
    //                 'text': `set args ${args}`,
    //                 'ignoreFailures': false
    //             });
    //     }
    //     return debugConf;
    // }

    // public async createDirectLaunchConfig(target: BazelTarget): Promise<vscode.DebugConfiguration> {
    //     const workingDirectory = '${workspaceFolder}';
    //     // Sandbox deploy is finished. Try to execute.
    //     const args = target.getRunArgs().toString();

    //     const targetPath = await this.bazelService.getBazelTargetBuildPath(target);
    //     // Program (executable) path with respect to workspace.
    //     const programPath = path.join(workingDirectory, targetPath);

    //     const envVars = EnvVarsUtils.listToArrayOfObjects(target.getEnvVars().toStringArray());
    //     const setupEnvVars = this.setupEnvVars;
    //     // Debug configuration.
    //     const debugConf: vscode.DebugConfiguration = {
    //         name: programPath,
    //         type: 'cppdbg',
    //         request: 'launch',
    //         program: programPath,
    //         stopAtEntry: false,
    //         cwd: '${workspaceFolder}',
    //         environment: [...setupEnvVars, ...envVars],
    //         externalConsole: false,
    //         MIMode: 'gdb',
    //         setupCommands: [
    //             {
    //                 description: 'Enable pretty-printing for gdb',
    //                 text: '-enable-pretty-printing',
    //                 ignoreFailures: true
    //             }
    //         ]
    //     };

    //     // Debugger does not accept an empty list as arguments
    //     if (args.length > 0) {
    //         debugConf.args = args.split(' ');
    //     }

    //     return debugConf;
    // }

    /* public refreshLaunchConfigs(target: BazelTarget) {
        if (target === undefined)
        {
            return;
        }

        this.createRunUnderLaunchConfig(target).then(runUnder => {
            this.createDirectLaunchConfig(target).then(direct => {
                const configs = [
                    runUnder, direct
                ];
                const oldConfigs = vscode.workspace
                    .getConfiguration('launch').get<vscode.DebugConfiguration[]>('configurations');

                if (oldConfigs) {
                    for (const c of oldConfigs) {
                        if (c.name !== runUnder.name &&
                            c.name !== direct.name) {
                            configs.push(c);
                        }
                    }
                }
                vscode.workspace
                    .getConfiguration('launch').update('configurations', configs, vscode.ConfigurationTarget.Workspace);
            });
        });
    } */
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