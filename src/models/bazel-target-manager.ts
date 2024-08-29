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
import { BazelAction, BazelTarget } from './bazel-target';

/**
 * Manager for handling Bazel targets across different actions.
 */
export class BazelTargetManager {
    private targets: Map<BazelAction, BazelTarget[]> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.loadTargets();
    }

    private loadTargets() {
        const storedTargets = this.context.workspaceState.get<{ [key: string]: BazelTarget[] }>('bazelTargets', {});
        this.targets = new Map(Object.entries(storedTargets));
    }

    public addTarget(target: BazelTarget) {
        const action = target.action;
        if (!this.targets.has(action)) {
            this.targets.set(action, []);
        }
        const actionTargets = this.targets.get(action)!;
        actionTargets.push(target);
        this.saveTargets();
    }

    public removeTarget(target: BazelTarget) {
        const action = target.action;
        if (this.targets.has(action)) {
            const updatedTargets = this.targets.get(action)!.filter(t => t.label !== target.label);
            if (updatedTargets.length > 0) {
                this.targets.set(action, updatedTargets);
            } else {
                this.targets.delete(action);
            }
            this.saveTargets();
        }
    }

    public getTargets(action?: BazelAction): BazelTarget[] {
        if (action) {
            return this.targets.get(action) || [];
        } else {
            const allTargets: BazelTarget[] = [];
            this.targets.forEach(targetsArray => {
                allTargets.push(...targetsArray);
            });
            return allTargets;
        }
    }

    private saveTargets() {
        const serializedTargets: { [key: string]: BazelTarget[] } = {};
        this.targets.forEach((value, key) => {
            serializedTargets[key] = value;
        });
        this.context.workspaceState.update('bazelTargets', serializedTargets);
    }
}