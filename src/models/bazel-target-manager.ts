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

import { BazelAction, BazelTarget, SerializedBazelTarget } from './bazel-target';
import { WorkspaceStateManager } from './workspace-state-manager';
import { BazelService } from '../services/bazel-service';
import { Console } from '../services/console';
import { FileStorageService } from '../services/file-storage-service';
import * as vscode from 'vscode';

export class BazelTargetManager {
    private targets: Map<BazelAction, BazelTarget[]> = new Map();
    private availableTargets: Map<BazelAction, BazelTarget[]> = new Map();
    private selectedTargets: Map<BazelAction, BazelTarget> = new Map();
    private targetsLoaded: Promise<void>;
    private availableTargetsLoaded: Promise<void>;
    private selectedTargetsLoaded: Promise<void>;

    private readonly targetsFileName = 'targets.json';
    private readonly availableTargetsFileName = 'availableTargets.json';

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly bazelService: BazelService,
        private readonly fileStorageService: FileStorageService,
        workspaceStateManager: WorkspaceStateManager
    ) {
        if (workspaceStateManager.versionChanged()) {
            this.clear();
            this.targetsLoaded = Promise.resolve();
        } else {
            this.targetsLoaded = this.loadTargets().then(() => {
                Console.log('User targets loaded successfully');
            }).catch(error => {
                Console.error('Error loading user targets:', error);
            });
        }

        this.selectedTargetsLoaded = this.loadSelectedTargets()
            .then(() => {
                Console.log('Selected targets loaded successfully');
            }).catch(error => {
                Console.error('Error loading targets:', error);
            });

        this.availableTargetsLoaded = this.loadAvailableTargets().then(() => {
            Console.log('Available targets loaded successfully');
        }).catch(error => {
            Console.error('Error loading targets:', error);
        });
    }

    public async areAvailableTargetsLoaded(): Promise<boolean> {
        const marker = Symbol('notResolved');
        return Promise.race([
            this.availableTargetsLoaded.then(() => true),
            Promise.resolve(marker).then(() => false),
        ]);
    }

    public async awaitLoading() {
        await Promise.all([this.targetsLoaded, this.selectedTargetsLoaded]);
    }

    // Make loadAvailableTargets async
    private async loadAvailableTargets(): Promise<void> {
        await this.fileStorageService.readJsonArrayElementsFromFileAsStream<SerializedBazelTarget>(this.availableTargetsFileName, (path, value) => {
            const action = path[0] as string;
            const targets = this.availableTargets.get(action) || [];
            targets.push(BazelTarget.fromJSON(this.context, this.bazelService, value));
            this.availableTargets.set(action, targets);
        });
        // if (rawData) {
        //     this.availableTargets = new Map(
        //         Object.entries(rawData).map(([action, targets]) => {
        //             return [action as BazelAction, targets.map(t => BazelTarget.fromJSON(this.context, this.bazelService, t))] as [string, BazelTarget[]];
        //         })
        //     );
        // }
    }

    // Make loadTargets async
    private async loadTargets(): Promise<void> {
        const rawData = await this.fileStorageService.readJsonFromFile<{ [key: string]: SerializedBazelTarget[] }>(this.targetsFileName);
        if (rawData) {
            this.targets = new Map(
                Object.entries(rawData).map(([action, targets]) => {
                    return [action as BazelAction, targets.map(t => BazelTarget.fromJSON(this.context, this.bazelService, t))] as [string, BazelTarget[]];
                })
            );
        }
    }

    // Make loadSelectedTargets async
    private async loadSelectedTargets(): Promise<void> {
        const storedTargets = this.context.workspaceState.get<{ [key: string]: SerializedBazelTarget }>('selectedTargets', {});

        const deserializedTargets = new Map<BazelAction, BazelTarget>();

        Object.entries(storedTargets).forEach(([action, target]) => {
            deserializedTargets.set(action as BazelAction, BazelTarget.fromJSON(this.context, this.bazelService, target)); // Deserialize BazelTarget
        });

        this.selectedTargets = deserializedTargets;
    }

    public getMapTargets(map: Map<BazelAction, BazelTarget[]>, action?: BazelAction): BazelTarget[] {
        if (action) {
            return map.get(action) || [];
        } else {
            const allTargets: BazelTarget[] = [];
            map.forEach(targetsArray => {
                allTargets.push(...targetsArray);
            });
            return allTargets;
        }
    }

    public getAvailableTargets(action?: BazelAction): BazelTarget[] {
        return this.getMapTargets(this.availableTargets, action);
    }

    public async updateAvailableTargets(targets: Map<BazelAction, BazelTarget[]>) {
        await this.availableTargetsLoaded;
        this.availableTargets = targets;
        this.saveAvailableTargets(); // Fire-and-forget, don't await
    }

    public addTarget(target: BazelTarget) {
        const actionTargets = this.targets.get(target.action) || [];
        actionTargets.push(target);
        this.targets.set(target.action, actionTargets);
        this.saveTargets(); // Fire-and-forget, don't await
    }

    public removeTarget(target: BazelTarget) {
        const action = target.action;
        if (this.targets.has(action)) {
            const targets = this.targets.get(action) || [];
            const updatedTargets = targets.filter(t => t.id !== target.id);
            if (updatedTargets.length > 0) {
                this.targets.set(action, updatedTargets);
            } else {
                this.targets.delete(action);
            }
            this.saveTargets(); // Fire-and-forget, don't await
        }
    }

    public hasTarget(target: BazelTarget): boolean {
        if (!this.targets.has(target.action)) {
            return false;
        }

        const targets = this.targets.get(target.action) || [];
        const index = targets.findIndex(t => t.id === target.id);
        if (index === -1) {
            return false;
        }
        return true;
    }

    public updateTarget(target: BazelTarget, oldTarget: BazelTarget) {
        if (target.action !== oldTarget.action) {
            throw Error('Cannot update targets of differing actions');
        }
        const action = oldTarget.action;
        if (this.targets.has(action)) {
            const targets = this.targets.get(action) || [];
            const index = targets.findIndex(t => t.id === oldTarget.id);
            if (index === -1) {
                throw Error('Old target not found in the list');
            }
            targets[index] = target;
            this.targets.set(action, targets);
            this.saveTargets(); // Fire-and-forget, don't await
        }
    }

    public getTargets(action?: BazelAction): BazelTarget[] {
        return this.getMapTargets(this.targets, action);
    }

    public removeSelectedTarget(target: BazelTarget) {
        if (this.selectedTargets.delete(target.action)) {
            this.saveSelectedTargets(); // Fire-and-forget, don't await
        }
    }

    public updateSelectedTarget(target: BazelTarget) {
        this.selectedTargets.set(target.action, target);
        this.saveSelectedTargets(); // Fire-and-forget, don't await
    }

    public getSelectedTarget(action: BazelAction): BazelTarget {
        if (this.selectedTargets.has(action)) {
            return this.selectedTargets.get(action) || new BazelTarget(this.context, this.bazelService, '', '', '', action, '');
        }
        return new BazelTarget(this.context, this.bazelService, '', '', '', action, '');
    }

    public getTargetActions(): BazelAction[] {
        return Array.from(this.targets.keys());
    }

    public async clear(): Promise<void> {
        try {
            await Promise.all([
                this.fileStorageService.deleteFile(this.availableTargetsFileName),
                this.fileStorageService.deleteFile(this.targetsFileName),
                this.context.workspaceState.update('selectedTargets', undefined)]);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // Make saveAvailableTargets async
    private async saveAvailableTargets(): Promise<void> {
        // Serialize the map to an object before saving
        const serializedTargets: { [key: string]: SerializedBazelTarget[] } = {};
        this.availableTargets.forEach((targets, action) => {
            serializedTargets[action] = targets.map(target => target.toJSON());
        });
        this.fileStorageService.writeJsonToFile(this.availableTargetsFileName, serializedTargets); // Fire-and-forgets
    }

    // Make saveTargets async
    private async saveTargets(): Promise<void> {
        // Serialize the map to an object before saving
        const serializedTargets: { [key: string]: SerializedBazelTarget[] } = {};
        this.targets.forEach((targets, action) => {
            serializedTargets[action] = targets.map(target => target.toJSON());
        });
        this.fileStorageService.writeJsonToFile(this.targetsFileName, serializedTargets); // Fire-and-forget
    }

    // Make saveSelectedTargets async
    private async saveSelectedTargets(): Promise<void> {
        const serializedTargets: { [key: string]: SerializedBazelTarget } = {};
        this.selectedTargets.forEach((target, action) => {
            serializedTargets[action] = target.toJSON();
        });
        this.context.workspaceState.update('selectedTargets', serializedTargets); // Fire-and-forget
    }
}
