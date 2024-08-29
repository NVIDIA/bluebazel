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
import * as vscode from 'vscode';
import { Storage } from './storage';
import { BazelTargetProperty } from './bazel-target-property';
import { ModelAccessor } from './model-accessor';

export type BazelAction = string; //'build' | 'run' | 'clean' | 'test' | etc.
export class BazelTarget {
    private envVars: BazelTargetProperty;
    private bazelArgs: BazelTargetProperty;
    private configArgs: BazelTargetProperty;
    private runArgs: BazelTargetProperty;


    constructor(
        public label: string,
        public detail: string,
        public action: BazelAction,
        private readonly workspaceState: vscode.Memento
    ) {

        this.envVars = new BazelTargetProperty('EnvVars',
            this,
            this.workspaceState,
            function (bazelTargetProperty: BazelTargetProperty): string {
                const ev = ModelAccessor.getStringArray(bazelTargetProperty);
                return ev.join(' && ');
            });

        this.bazelArgs = new BazelTargetProperty('BazelArgs',
            this,
            this.workspaceState,
            function (bazelTargetProperty: BazelTargetProperty): string {
                let bazelArgs = '';
                const args = ModelAccessor.getStringArray(bazelTargetProperty);
                args.forEach((value:string, index:number) => {
                    bazelArgs += `--${value} `;
                });
                return bazelArgs;
            });

        this.configArgs = new BazelTargetProperty('ConfigArgs',
            this,
            this.workspaceState,
            function (bazelTargetProperty: BazelTargetProperty): string {
                let configArgs = '';
                const args = ModelAccessor.getStringArray(bazelTargetProperty);
                args.forEach((value:string, index:number) => {
                    configArgs += `--config=${value} `;
                });
                return configArgs;
            });

        this.runArgs = new BazelTargetProperty('RunArgs',
            this,
            this.workspaceState,
            function (bazelTargetProperty: BazelTargetProperty): string {
                const value = ModelAccessor.getString(bazelTargetProperty);
                return value;
            });
    }

    public getEnvVars(): BazelTargetProperty {
        return this.envVars;
    }

    public getBazelArgs(): BazelTargetProperty {
        return this.bazelArgs;
    }

    public getConfigArgs(): BazelTargetProperty {
        return this.configArgs;
    }

    public getRunArgs(): BazelTargetProperty {
        return this.runArgs;
    }
}

