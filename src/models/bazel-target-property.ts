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

import { BazelTarget } from './bazel-target';
import { BazelTargetPropertyHistory } from './bazel-target-property-history';
import * as vscode from 'vscode';

export class BazelTargetProperty {
    public readonly id: string = '';
    private readonly history: BazelTargetPropertyHistory;

    constructor(
        private readonly context: vscode.ExtensionContext,
        public readonly label: string,
        public readonly name: string,
        target: BazelTarget,
        private readonly toStringFn: (bazelTargetProperty: BazelTargetProperty) => string
    ) {
        this.id = `${target.action}${name}For${target.id}`;
        this.history = new BazelTargetPropertyHistory(context, name, 10);
    }

    public clone(newTarget: BazelTarget): BazelTargetProperty {
        return new BazelTargetProperty(
            this.context,
            this.label,
            this.name,
            newTarget,  // Pass the new BazelTarget instance
            this.toStringFn
        );
    }

    public update(value: string) {
        this.history.add(value);
        this.context.workspaceState.update(this.id, value);
    }

    public get(): string {
        const value = this.context.workspaceState.get<string>(this.id) || '';
        return value;
    }

    public getHistory(): string[] {
        return this.history.getHistory();
    }

    public toString(): string {
        return this.toStringFn(this);
    }
}

