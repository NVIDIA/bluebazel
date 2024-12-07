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
import { isRemoteSession } from '../../services/network-utils';
import { LanguagePlugin } from '../language-plugin';
import * as path from 'path';
import * as vscode from 'vscode';


export class GoLanguagePlugin implements LanguagePlugin {
    public readonly supportedLanguages: string[];

    constructor(private readonly context: vscode.ExtensionContext,
        private readonly bazelService: BazelService,
        private readonly setupEnvVars: string[]
    ) {
        this.supportedLanguages = ['go'];
    }

    public getDebugRunUnderCommand(port: number): string {
        return `dlv exec --headless --listen=:${port} --api-version=2`;
    }

    public getDebugEnvVars(target: BazelTarget): string[] {
        // This is necessary because bazel tests in go will call bzltestutils.Wrap and
        // spawn a child process which dlv is not connected to. Turn it off.
        return target.ruleType.includes('test') ? ['GO_TEST_WRAP=0'] : [];
    }

    public async createDebugDirectLaunchConfig(target: BazelTarget, _cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
        const workingDirectory = '${workspaceFolder}';
        const targetPath = target.buildPath;//await this.bazelService.getBazelTargetBuildPath(target, cancellationToken);
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

    public async createDebugAttachConfig(target: BazelTarget,
        port: number,
        _cancellationToken?: vscode.CancellationToken): Promise<vscode.DebugConfiguration> {
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

    /**
     * Regex to match test functions in Go.
     * Example matches:
     * func TestFunctionName(t *testing.T) {
     * func TestAnotherFunction(t *testing.T) {
     */
    public getCodeLensTestRegex(): RegExp {
        return /^func\s+(Test\w+)\(\w+\s+\*testing\.T\)/gm;
    }

    /**
     * Regex to match main function definitions in Go.
     * Example matches:
     * func main() {
     */
    public getCodeLensRunRegex(): RegExp {
        return /^func\s+(main)\s*\(\s*\)\s*\{/gm;
    }

}