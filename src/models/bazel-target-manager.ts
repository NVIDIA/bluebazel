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
import { BazelAction, BazelTarget } from './bazel-target';
import * as vscode from 'vscode';

/**
 * Manager for handling Bazel targets across different actions.
 */
export class BazelTargetManager {
    private targets: Map<BazelAction, BazelTarget[]> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.loadTargets();
    }

    private loadTargets() {
        const storedTargets = this.context.workspaceState.get<{ [key: string]: { label: string, detail: string, action: BazelAction, id: string }[] }>('bazelTargets', {});

        const deserializedTargets = new Map<BazelAction, BazelTarget[]>();

        // Deserialize each stored target and recreate the Map
        Object.entries(storedTargets).forEach(([action, targets]) => {
            deserializedTargets.set(action as BazelAction, targets.map(t => BazelTarget.fromJSON(this.context, t)));
        });

        // Define some mock Bazel targets
        const mockTargets: { [key: string]: BazelTarget[] } = {
            build: [
                new BazelTarget(this.context, '//...', '//...', 'build', '1'),
                new BazelTarget(this.context, '//src/bar:dude', '//src/bar:dude', 'build', '2'),
            ],
            test: [
                new BazelTarget(this.context, '//tests/this:...', '//tests/this:...', 'test', '3'),
                new BazelTarget(this.context, '//tests/other:one', '//tests/other:one', 'test', '4'),
            ],
            run: [
                new BazelTarget(this.context, '//tools/this:app', '//tools/this:app', 'run', '5'),
                new BazelTarget(this.context, '//samples/other:one', '//samples/other:one', 'run', '6'),
            ]
        };

        this.targets = new Map(Object.entries(mockTargets));
    }

    public addTarget(target: BazelTarget) {
        const action = target.action;
        if (!this.targets.has(action)) {
            this.targets.set(action, []);
        }
        const actionTargets = this.targets.get(action) || [];
        actionTargets.push(target);
        this.saveTargets();
    }

    public removeTarget(target: BazelTarget) {
        const action = target.action;
        if (this.targets.has(action)) {
            const targets = this.targets.get(action) || [];
            const updatedTargets = targets.filter(t => t.label !== target.label);
            if (updatedTargets.length > 0) {
                this.targets.set(action, updatedTargets);
            } else {
                this.targets.delete(action);
            }
            this.saveTargets();
        }
    }

    public updateTarget(target: BazelTarget, oldTarget: BazelTarget) {
        if (target.action !== oldTarget.action) {
            throw Error('Cannot update targets of differing actions');
        }
        const action = oldTarget.action;
        if (this.targets.has(action)) {
            const targets = this.targets.get(action) || [];
            // Find the index of the old target
            const index = targets.findIndex(t => t.label === oldTarget.label);
            if (index === -1) {
                throw Error('Old target not found in the list');
            }

            // Replace the old target with the new target at the found index
            targets[index] = target;

            // Update the map with the new list of targets
            this.targets.set(action, targets);
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

    public getTargetActions(): BazelAction[] {
        return Array.from(this.targets.keys());
    }

    private saveTargets() {
        this.context.workspaceState.update('bazelTargets', this.targets);
    }
}