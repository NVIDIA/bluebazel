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

import { BazelTargetControllerManager } from './target-controllers/bazel-target-controller-manager';
import { BazelActionManager } from '../models/bazel-action-manager';
import { BazelAction, BazelTarget } from '../models/bazel-target';
import { BazelTargetManager } from '../models/bazel-target-manager';
import { BazelService } from '../services/bazel-service';
import { IconService } from '../services/icon-service';
import { BazelTargetQuickPick } from '../ui/bazel-target-quick-pick';
import { BazelTargetTreeProvider } from '../ui/bazel-target-tree-provider';
import * as vscode from 'vscode';

export class BazelTargetOperationsController {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly bazelService: BazelService,
        private readonly iconService: IconService,
        private readonly bazelTargetControllerManager: BazelTargetControllerManager,
        private readonly bazelActionManager: BazelActionManager,
        private readonly bazelTargetManager: BazelTargetManager,
        private readonly bazelTreeProvider: BazelTargetTreeProvider
    ) {

    }

    public async pickTarget(targetOrAction?: BazelTarget | BazelAction) {
        const oldTarget = this.resolveOldTarget(targetOrAction);

        const actions = oldTarget
            ? [oldTarget.action]
            : await this.bazelActionManager.getActions();

        const bazelTargetQuickPick = new BazelTargetQuickPick(actions, this.iconService, this.bazelTargetManager);

        try {
            const selection = await bazelTargetQuickPick.show();
            this.handleTargetSelection(selection, oldTarget);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    /**
     * Resolves the target or action into an old BazelTarget, if applicable.
     */
    private resolveOldTarget(targetOrAction?: BazelTarget | BazelAction): BazelTarget | undefined {
        if (!targetOrAction) return undefined;

        return targetOrAction instanceof BazelTarget
            ? targetOrAction
            : BazelTarget.createEmpty(this.context, this.bazelService, targetOrAction);
    }

    /**
     * Handles the selection from the QuickPick.
     */
    private handleTargetSelection(selection: BazelTarget | string | undefined, oldTarget?: BazelTarget) {
        if (selection instanceof BazelTarget) {
            this.addOrUpdateTarget(selection, oldTarget);
        } else if (selection) {
            const { action, target } = this.resolveActionAndTarget(selection, oldTarget);
            const newTarget = new BazelTarget(
                this.context,
                this.bazelService,
                target,
                target,
                '',
                action,
                oldTarget?.ruleType || ''
            );
            this.addOrUpdateTarget(newTarget, oldTarget);
        }
    }

    /**
     * Resolves the action and target based on selection and oldTarget.
     */
    private resolveActionAndTarget(selection: string, oldTarget?: BazelTarget) {
        if (oldTarget) {
            return { action: oldTarget.action, target: selection };
        } else {
            const [action, ...targetParts] = selection.split(' ');
            return { action, target: targetParts.join(' ') };
        }
    }


    private addOrUpdateTarget(newTarget: BazelTarget, oldTarget?: BazelTarget) {
        if (oldTarget && this.bazelTargetManager.hasTarget(oldTarget)) {
            this.bazelTargetManager.updateTarget(newTarget.clone(), oldTarget);
        } else {
            const clonedTarget = newTarget.clone();
            this.bazelTargetManager.addTarget(clonedTarget);
            this.bazelTreeProvider.expandTarget(clonedTarget);
        }
        const targetsOfAction = this.bazelTargetManager.getTargets(newTarget.action);
        if (targetsOfAction.length === 1) {
            this.bazelTargetManager.updateSelectedTarget(targetsOfAction[0]);
        }
        this.bazelTreeProvider.refresh();
    }

    public async copyTarget(target: BazelTarget) {
        const clonedTarget = target.clone(true);
        this.bazelTargetManager.addTarget(clonedTarget);
        this.bazelTreeProvider.expandTarget(clonedTarget);
        this.bazelTreeProvider.refresh();
    }

    public removeTarget(target: BazelTarget) {
        this.bazelTargetManager.removeTarget(target);
        if (this.bazelTargetManager.getSelectedTarget(target.action).isEqualTo(target)) {
            this.bazelTargetManager.removeSelectedTarget(target);
        }
        this.bazelTreeProvider.refresh();
    }

    public async copyCommandToClipboard(target: BazelTarget) {
        const controller = this.getController(target.action);
        const command = await controller.getExecuteCommand(target);
        vscode.env.clipboard.writeText(command || '');
        vscode.window.showInformationMessage('Copied to clipboard');
    }

    public async executeTarget(target: BazelTarget) {
        const controller = this.getController(target.action);
        controller.execute(target).catch(error => {
            vscode.window.showErrorMessage(error);
        });
    }

    private getController(action: BazelAction) {
        const controller = this.bazelTargetControllerManager.getController(action);
        if (!controller) {
            vscode.window.showErrorMessage(`Action ${action} is unsupported`);
            throw new Error(`No controller for action ${action}`);
        }
        return controller;
    }
}