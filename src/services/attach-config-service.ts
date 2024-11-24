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

import { BazelService } from './bazel-service';
import { EnvVarsUtils } from './env-vars-utils';
import { isRemoteSession } from './network-utils';
import { BazelTarget } from '../models/bazel-target';
import * as vscode from 'vscode';
import path = require('path');

export class AttachConfigService {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly bazelService: BazelService,
        private readonly setupEnvVars: string[]
    ) {}

    /**
     * Create an attach debug configuration based on the target language.
     */
    public async createAttachConfig(target: BazelTarget, port: number): Promise<vscode.DebugConfiguration> {
        switch (BazelService.inferLanguageFromRuleType(target.ruleType)) {
        case 'cpp':
            return this.createCppAttachConfig(target, port);
        case 'python':
            return this.createPythonAttachConfig(target, port);
        case 'go':
            return this.createGoAttachConfig(target, port);
        default:
            throw new Error(`Unsupported language for attach: ${target.ruleType}`);
        }
    }

    /**
     * Create a C++ attach configuration.
     */
    private async createCppAttachConfig(target: BazelTarget, port: number): Promise<vscode.DebugConfiguration> {
        const bazelTarget = BazelService.formatBazelTargetFromPath(target.buildPath);
        const workingDirectory = '${workspaceFolder}';
        const targetPath = await this.bazelService.getBazelTargetBuildPath(target);
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
     * Create a Python attach configuration.
     */
    private createPythonAttachConfig(target: BazelTarget, port: number): vscode.DebugConfiguration {
        return {
            name: `${target.label} (Attach)`,
            type: 'debugpy',
            request: 'attach',
            connect: {
                host: 'localhost',
                port: port // Port where debugpy is listening
            },
            pathMappings: [
                {
                    localRoot: '${workspaceFolder}',
                    remoteRoot: '.'
                }
            ],
        };
    }

    /**
     * Create a Go attach configuration.
     */
    private createGoAttachConfig(target: BazelTarget, port: number): vscode.DebugConfiguration {
        const debugConfig = {
            name: `${target.label} (Attach)`,
            type: 'go',
            request: 'attach',
            mode: 'remote',
            host: '127.0.0.1',
            port: port, // Port where dlv is listening
            cwd: '${workspaceFolder}',
            trace: 'verbose', // Enable verbose logging for debugging
            showLog: true,
        } as vscode.DebugConfiguration;

        if (isRemoteSession()) {
            // Paths don't match up for vscode over ssh
            debugConfig.substitutePath = [ // This is necessary for test breakpoints to work
                {
                    from: '${workspaceFolder}',
                    to: ''
                }
            ];
        }
        return debugConfig;
    }
}
