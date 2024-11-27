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
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { LanguagePlugin } from '../language-plugin';
import * as path from 'path';
import * as vscode from 'vscode';


export class PythonLanguagePlugin implements LanguagePlugin {
    public readonly supportedLanguages: string[];

    constructor(private readonly context: vscode.ExtensionContext,
        private readonly setupEnvVars: string[]
    ) {
        this.supportedLanguages = ['python'];
    }

    public getDebugRunUnderCommand(port: number): string {
        throw new Error('python run under is not yet supported');
        //return `python3 -m debugpy --listen :${port} --wait-for-client`;
    }

    public getDebugEnvVars(_target: BazelTarget): string[] {
        return [];
    }

    public async createDebugDirectLaunchConfig(
        target: BazelTarget,
        _cancellationToken?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration> {
        const workingDirectory = '${workspaceFolder}';

        // Resolve the Bazel-built file dynamically
        const bazelOutputPath = `${workingDirectory}/${target.buildPath}`;
        const pythonFile = `${bazelOutputPath}.runfiles/_main/${target.buildPath}`; // Generic runfile path

        const args = target.getRunArgs().toString();
        const envVars = EnvVarsUtils.listToObject(target.getEnvVars().toStringArray());

        return {
            name: `${target.label} (Debug Python)`,
            type: 'python',
            request: 'launch',
            program: pythonFile, // Bazel-compiled runfile
            args: args.length > 0 ? args.split(' ') : [],
            pathMappings: [
                {
                    localRoot: `${workingDirectory}/${path.dirname(target.buildPath)}`, // Directory containing the local source
                    remoteRoot: `${bazelOutputPath}.runfiles/_main/${path.dirname(target.buildPath)}` // Remote Bazel runfiles directory
                }
            ],
            stopOnEntry: false,
            cwd: workingDirectory,
            env: { ...EnvVarsUtils.listToObject(this.setupEnvVars), ...envVars },
            console: 'integratedTerminal',
            justMyCode: true
        } as vscode.DebugConfiguration;
    }

    public async createDebugAttachConfig(target: BazelTarget,
        port: number,
        _cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
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

    public getCodeLensTestRegex(): RegExp {
        return /(?:^|\s)def\s+(test_\w+)\(/gm;
    }

}