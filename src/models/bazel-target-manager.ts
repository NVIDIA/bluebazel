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
import { BazelAction, BazelTarget, SerializedBazelTarget } from './bazel-target';
import { BazelService } from '../services/bazel-service';
import * as vscode from 'vscode';

/**
 * Manager for handling Bazel targets across different actions.
 */
export class BazelTargetManager {
    private targets: Map<BazelAction, BazelTarget[]> = new Map();
    private availableRunTargets: BazelTarget[] = [];
    private selectedTargets: Map<BazelAction, BazelTarget> = new Map();

    constructor(private readonly context: vscode.ExtensionContext,
        private readonly bazelService: BazelService
    ) {
        this.loadTargets();
        this.loadSelectedTargets();
        this.loadAvailableRunTargets();
    }

    // Load run targets from storage
    private loadAvailableRunTargets() {
        // Retrieve stored BazelTarget objects from workspace state (as plain objects)
        const storedTargets = this.context.workspaceState.get<SerializedBazelTarget[]>('bazelAvailableRunTargets', []);
        // Deserialize each stored target into an instance of BazelTarget
        this.availableRunTargets = storedTargets.map(item => BazelTarget.fromJSON(this.context, this.bazelService, item));
    }

    // Methods to manage run targets
    public getAvailableRunTargets(): BazelTarget[] {
        return this.availableRunTargets;
    }

    public updateAvailableRunTargets(targets: BazelTarget[]) {
        this.availableRunTargets = targets;
        this.context.workspaceState.update('bazelAvailableRunTargets', this.availableRunTargets);
    }

    private loadTargets() {
        // Retrieve stored targets from workspaceState
        const storedTargets = this.context.workspaceState.get<{ [key: string]: SerializedBazelTarget[] }>('bazelTargets', {});

        const deserializedTargets = new Map<BazelAction, BazelTarget[]>();

        // Deserialize each stored target and recreate the Map
        Object.entries(storedTargets).forEach(([action, targets]) => {
            deserializedTargets.set(action as BazelAction, targets.map(t => BazelTarget.fromJSON(this.context, this.bazelService, t)));
        });

        this.targets = deserializedTargets;
    }

    private loadSelectedTargets() {
        // Retrieve stored targets from workspaceState
        const storedTargets = this.context.workspaceState.get<{ [key: string]: SerializedBazelTarget }>('selectedTargets', {});

        const deserializedTargets = new Map<BazelAction, BazelTarget>();

        // Deserialize each stored target and recreate the Map
        Object.entries(storedTargets).forEach(([action, target]) => {
            deserializedTargets.set(action as BazelAction, BazelTarget.fromJSON(this.context, this.bazelService, target));
        });

        this.selectedTargets = deserializedTargets;
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

    public updateSelectedTarget(target: BazelTarget) {
        this.selectedTargets.set(target.action, target);
        this.saveSelectedTargets();
    }

    public getSelectedTarget(action: BazelAction): BazelTarget {
        if (this.selectedTargets.has(action)) {
            return this.selectedTargets.get(action) || new BazelTarget(this.context, this.bazelService, '', '', action);
        }
        return new BazelTarget(this.context, this.bazelService, '', '', action);
    }

    public getTargetActions(): BazelAction[] {
        return Array.from(this.targets.keys());
    }

    private saveTargets() {
        // Serialize the map to an object before saving
        const serializedTargets: { [key: string]: SerializedBazelTarget[] } = {};

        this.targets.forEach((targets, action) => {
            serializedTargets[action] = targets.map(target => target.toJSON());
        });

        this.context.workspaceState.update('bazelTargets', serializedTargets);
    }

    private saveSelectedTargets() {
        // Serialize the map to an object before saving
        const serializedTargets: { [key: string]: SerializedBazelTarget } = {};

        this.selectedTargets.forEach((target, action) => {
            serializedTargets[action] = target.toJSON();
        });

        this.context.workspaceState.update('bazelTargets', serializedTargets);
    }
}