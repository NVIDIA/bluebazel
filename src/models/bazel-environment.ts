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

import { ConfigurationManager } from '../services/configuration-manager';
import { EnvironmentService } from '../services/environment-service';
import * as vscode from 'vscode';
export class BazelEnvironment {
    private envVars: string[] = [];

    public static async create(context: vscode.ExtensionContext,
        configurationManager: ConfigurationManager
    ): Promise<BazelEnvironment> {
        const instance = new BazelEnvironment();
        instance.envVars = await this.loadEnvVars(context, configurationManager);
        return instance;
    }

    private static async loadEnvVars(context: vscode.ExtensionContext,
        configurationManager: ConfigurationManager
    ): Promise<string[]> {
        const result = EnvironmentService.fetchSetupEnvironment(context, configurationManager.getSetupEnvironmentCommand());
        context.workspaceState.update('setupEnvVars', result);
        return result;
    }

    // Methods to manage environment variables
    public getEnvVars(): string[] {
        return this.envVars;
    }
}