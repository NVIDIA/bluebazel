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

import { BazelTargetMultiProperty } from './bazel-target-multi-property';
import { BazelTargetProperty } from './bazel-target-property';
import { BazelService } from '../services/bazel-service';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';

export interface SerializedBazelTarget {
    label: string,
    detail: string,
    action: BazelAction,
    language: string,
    id: string
}

export type BazelAction = string;
export class BazelTarget {
    private envVars: BazelTargetMultiProperty;
    private bazelArgs: BazelTargetMultiProperty;
    private configArgs: BazelTargetMultiProperty;
    private runArgs: BazelTargetProperty;
    private language: string;
    public readonly id: string;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly bazelService: BazelService,
        public label: string,
        public detail: string,
        public action: BazelAction,
        language?: string,
        id?: string
    )
    {
        if (id === undefined) {
            this.id = `${action}For${detail}-${uuidv4()}`;
        } else {
            this.id = id;
        }

        this.envVars = new BazelTargetMultiProperty(context, 'Environment', 'EnvVars',
            this,
            function (bazelTargetProperty: BazelTargetMultiProperty): string {
                const ev = bazelTargetProperty.toStringArray();
                return ev.join(' && ');
            });

        this.bazelArgs = new BazelTargetMultiProperty(context, 'Args', 'BazelArgs',
            this,
            function (bazelTargetProperty: BazelTargetMultiProperty): string {
                let bazelArgs = '';
                const args = bazelTargetProperty.toStringArray();
                args.forEach((value:string) => {
                    bazelArgs += `${value} `;
                });
                return bazelArgs;
            },
            (cancellationToken): Promise<string[]> => {
                return this.bazelService.fetchArgsForAction(this.action, cancellationToken);
            },
            false);

        this.configArgs = new BazelTargetMultiProperty(context, 'Config', 'ConfigArgs',
            this,
            function (bazelTargetProperty: BazelTargetMultiProperty): string {
                let configArgs = '';
                const args = bazelTargetProperty.toStringArray();
                args.forEach((value:string) => {
                    configArgs += `--config=${value} `;
                });
                return configArgs;
            },
            (cancellationToken): Promise<string[]> => {
                return this.bazelService.fetchConfigsForAction(this.action, cancellationToken);
            },
            false);

        this.runArgs = new BazelTargetProperty(context, 'Run args', 'RunArgs',
            this,
            function (bazelTargetProperty: BazelTargetProperty): string {
                const value = bazelTargetProperty.get();
                return value;
            });

        if (language !== undefined) {
            this.language = language;
        } else {
            this.language = 'unknown';
        }
    }

    // Method to clone the target with a new ID
    public clone(cloneProperties = false): BazelTarget {
        const newTarget = new BazelTarget(this.context, this.bazelService, this.label, this.detail, this.action, this.language);

        if (cloneProperties) {
            // Clone the properties
            newTarget.envVars = this.envVars.clone(newTarget);
            newTarget.bazelArgs = this.bazelArgs.clone(newTarget);
            newTarget.configArgs = this.configArgs.clone(newTarget);
            newTarget.runArgs = this.runArgs.clone(newTarget);
        }

        return newTarget;
    }

    public async getLanguage(): Promise<string> {
        if (this.language === 'unknown') {
            const language = await this.bazelService.fetchTargetLanguageFromBuildFile(this);
            this.language = language;
            return Promise.resolve(language);
        }
        return this.language;
    }

    public getEnvVars(): BazelTargetMultiProperty {
        return this.envVars;
    }

    public getBazelArgs(): BazelTargetMultiProperty {
        return this.bazelArgs;
    }

    public getConfigArgs(): BazelTargetMultiProperty {
        return this.configArgs;
    }

    public getRunArgs(): BazelTargetProperty {
        return this.runArgs;
    }

    // Method to get a serializable version of the BazelTarget object
    public toJSON(): SerializedBazelTarget {
        return {
            label: this.label,
            detail: this.detail,
            action: this.action,
            language: this.language,
            id: this.id
        };
    }

    // Static method to create a BazelTarget object from serialized data
    public static fromJSON(context: vscode.ExtensionContext, bazelService: BazelService, data: SerializedBazelTarget): BazelTarget {
        return new BazelTarget(context, bazelService, data.label, data.detail, data.action, data.language, data.id);
    }

    public isEqualTo(otherTarget: BazelTarget): boolean {
        return (
            this.label === otherTarget.label &&
            this.detail === otherTarget.detail &&
            this.action === otherTarget.action &&
            this.language === otherTarget.language &&
            this.id === otherTarget.id
        );
    }
}

