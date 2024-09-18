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

import { ExtensionUtils } from './extension-utils';
import { ShellService } from './shell-service';
import { WorkspaceService } from './workspace-service';
import * as vscode from 'vscode';


export class EnvironmentService {

    public static async fetchSetupEnvironment(context: vscode.ExtensionContext, envSetupCommand: string): Promise<string[]> {
        const extName = ExtensionUtils.getExtensionName(context);
        const envDelimiter = `---${extName} setup---`;
        if (envSetupCommand) {
            const result = await ShellService.run(`${envSetupCommand} && echo ${envDelimiter} && printenv`, WorkspaceService.getInstance().getWorkspaceFolder().uri.path, {});

            const env = result.stdout.replace(new RegExp(`[\\s\\S]*?${envDelimiter}\n`, 'g'), '').split('\n');
            const envArray: string[] = [];
            let currentVariable = '';
            for (const line of env) {
                if (line.includes('=')) {
                    if (currentVariable) {
                        const [name, value] = currentVariable.split('=');
                        envArray.push(`${name}=${value}`);
                    }
                    currentVariable = line;
                } else if (currentVariable) {
                    currentVariable += `\n${line}`;
                }
            }

            if (currentVariable) {
                const [name, value] = currentVariable.split('=');
                envArray.push(`${name}=${value}`);
            }

            return envArray;
        }
        return [];
    }
}