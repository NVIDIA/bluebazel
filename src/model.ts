/////////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2023 NVIDIA Corporation
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
import * as vscode from 'vscode';
import * as common from './common';


export interface ModelItemString
{
    label: string,
    value: string
}

export class BazelModel {
    constructor(private readonly workspaceState: vscode.Memento) {

    }

    public update(key: string, data: any) {
        this.workspaceState.update(key, data);
    }

    public get<T>(key: string) {
        const value = this.workspaceState.get<T>(key);
        return value;
    }

    public getString(key: string): string {
        const value = this.workspaceState.get(key);
        if (typeof value !== 'string') {
            return '';
        } else {
            return value;
        }
    }

    public getWithDefault<T>(key: string, defaultValue?: T) {
        const value = this.workspaceState.get(key);
        if (value === undefined) {
            return defaultValue;
        }
        return value;
    }

    public getTarget(type: common.TargetType) {
        if (type === common.TargetType.BUILD) {
            return this.workspaceState.get<ModelItemString>(common.WORKSPACE_KEYS.buildTarget) || { label: '', value: '' };
        } else if (type === common.TargetType.RUN) {
            return this.workspaceState.get<ModelItemString>(common.WORKSPACE_KEYS.runTarget) || { label: '', value: '' };
        } else if (type === common.TargetType.TEST) {
            return this.workspaceState.get<ModelItemString>(common.WORKSPACE_KEYS.testTarget) || { label: '', value: '' };
        }
        return { label: '', value: '' };
    }

    private getBazelArgs(id: string) {
        let configArgs = '';
        const args = this.getStringArray(id);
        args.forEach((value, index) => {
            configArgs += `--${value} `;
        });
        return configArgs;
    }

    private getConfigArgs(id: string) {
        let configArgs = '';
        const args = this.getStringArray(id);
        args.forEach((value, index) => {
            configArgs += `--config=${value} `;
        });
        return configArgs;
    }



    public getBuildEnvVariables() {
        let vars = '';
        const set = this.getBuildEnvVars();
        set.forEach((value, index) => {
            vars += `--action_env=${value} `;
        });
        return vars;
    }

    public getRunEnvVariables() {
        let vars = '';
        const set = this.getRunEnvVars();
        set.forEach((value, index) => {
            vars += `export ${value} && `;
        });

        return vars;
    }

    public getTestEnvVariables(): string {
        let vars = '';
        const set = this.getTestEnvVars();
        set.forEach((value, index) => {
            vars += `--test_env=${value} `;
        });
        return vars;
    }

    public getBazelBuildArgs()
    {
        return this.getBazelArgs(common.WORKSPACE_KEYS.bazelBuildArgs);
    }

    public getBazelRunArgs()
    {
        return this.getBazelArgs(common.WORKSPACE_KEYS.bazelRunArgs);
    }

    public getBazelTestArgs()
    {
        return this.getBazelArgs(common.WORKSPACE_KEYS.bazelTestArgs);
    }

    public getBuildConfigArgs()
    {
        return this.getConfigArgs(common.WORKSPACE_KEYS.buildConfigs);
    }

    public getRunConfigArgs()
    {
        return this.getConfigArgs(common.WORKSPACE_KEYS.runConfigs);
    }

    public getTestConfigArgs()
    {
        return this.getConfigArgs(common.WORKSPACE_KEYS.testConfigs);
    }

    private getStringArray(key: string): string[] {
        const values = this.workspaceState.get<string[]>(key);
        if (!values) {
            return [];
        }
        return values;
    }

    public getBuildEnvVars(): string[] {
        return this.getStringArray(common.WORKSPACE_KEYS.buildEnvVars);
    }

    public getRunEnvVars(): string[] {
        return this.getStringArray(common.WORKSPACE_KEYS.runEnvVars);
    }

    public getTestEnvVars(): string[] {
        return this.getStringArray(common.WORKSPACE_KEYS.testEnvVars);
    }

    public getSetupEnvVars(): string[] {
        return this.getStringArray(common.WORKSPACE_KEYS.setupEnvVars);
    }

    public getRunArgs(target: string): string {
        const key = common.getWorkspaceKeyUniqueToTarget(common.WORKSPACE_KEYS.runArgs, target);
        const value = this.getString(key);
        return value;
    }

    public getTestArgs(target: string): string {
        const key = common.getWorkspaceKeyUniqueToTarget(common.WORKSPACE_KEYS.testArgs, target);
        const value = this.getString(key);
        const pattern = /(--\S+)/g;
        const result = value.replace(pattern, '--test_arg $1');
        return result;
    }
}