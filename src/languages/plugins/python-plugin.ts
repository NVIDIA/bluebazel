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
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';



export class PythonLanguagePlugin implements LanguagePlugin {
    public readonly supportedLanguages: string[];

    constructor(private readonly context: vscode.ExtensionContext,
        private readonly bazelService: BazelService,
        private readonly setupEnvVars: string[]
    ) {
        this.supportedLanguages = ['python'];
    }

    public getDebugRunUnderCommand(_port: number): string {
        throw new Error('Python debugpy does not support bazel debugging (try debugging directly)');
    }

    public getDebugEnvVars(_target: BazelTarget): string[] {
        return [];
    }

    public async createDebugDirectLaunchConfig(
        target: BazelTarget,
        cancellationToken?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration> {
        let pythonFile = '';
        try {
            const runfiles = await this.bazelService.getRunfilesLocation(target, cancellationToken);
            pythonFile = this.findMainInRunfiles(runfiles);
        } catch (error) {
            return Promise.reject(error);
        }

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
                    localRoot: '${workspaceFolder}', // Directory containing the local source
                    remoteRoot: '.' // Remote Bazel runfiles directory
                }
            ],
            stopOnEntry: false,
            cwd: '${workspaceFolder}',
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

    private findMainInRunfiles(runfilesPath: string): string {
        const files = fs.readdirSync(runfilesPath);

        for (const file of files) {
            const fullPath = path.join(runfilesPath, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                try {
                    // Recursively search subdirectories
                    const mainFile = this.findMainInRunfiles(fullPath);
                    if (mainFile) {
                        return mainFile;
                    }
                } catch (error) {
                    // Continue searching other branches
                }
            } else if (file.endsWith('.py')) {
                // Check if the file contains `if __name__ == "__main__"`
                const content = fs.readFileSync(fullPath, 'utf-8');
                if (content.includes('if __name__ == "__main__"')) {
                    console.log(`Main function found in: ${fullPath}`);
                    return fullPath;
                }
            }
        }

        // If no match found in this branch, throw an error
        throw new Error('No Python file with \'if __name__ == "__main__"\' found');
    }


}