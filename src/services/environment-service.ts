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

    public static async fetchSetupEnvironment(
        context: vscode.ExtensionContext,
        envSetupCommand: string,
        cancellationToken?: vscode.CancellationToken
    ): Promise<string[]> {
        const extName = ExtensionUtils.getExtensionName(context);
        const envDelimiter = `---${extName} setup---`;

        if (envSetupCommand) {
            try {
                // Run the setup command, ensuring it prints the environment variables
                const result = await ShellService.run(
                    `${envSetupCommand} && echo ${envDelimiter} && env`,
                    WorkspaceService.getInstance().getWorkspaceFolder().uri.path,
                    {},
                    cancellationToken
                );

                // Remove everything before the delimiter, then split the output by newlines
                const env = result.stdout
                    .replace(new RegExp(`[\\s\\S]*?${envDelimiter}\n`, 'g'), '')
                    .split('\n');

                const envArray: string[] = [];
                let currentVariable = '';

                for (const line of env) {
                    // Look for the first '=' to avoid issues with values containing '='
                    const index = line.indexOf('=');
                    if (index !== -1) {
                        if (currentVariable) {
                            envArray.push(currentVariable);  // Push previous variable
                        }
                        currentVariable = line;  // Start new variable
                    } else if (currentVariable) {
                        // Handle case where the variable is spread over multiple lines (unlikely for environment variables)
                        currentVariable += `\n${line}`;
                    }
                }

                // Push the last variable
                if (currentVariable) {
                    envArray.push(currentVariable);
                }

                return envArray;
            } catch (error) {
                // Log the error for debugging purposes
                console.error('Error fetching setup environment:', error);
                return Promise.reject(error);
            }
        }

        // Return an empty array if no setup command is provided
        return [];
    }

}