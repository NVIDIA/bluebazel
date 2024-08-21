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
import { BazelActionManager } from '../../models/bazel-action-manager';
import { BazelTargetOperationsController } from '../bazel-target-operations-controller';
import { ExtensionUtils } from '../../services/extension-utils';
import { showQuickPick } from '../../ui/quick-pick';
import * as vscode from 'vscode';
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetControllerManager } from '../target-controllers/bazel-target-controller-manager';
import { BazelService } from '../../services/bazel-service';
import { BazelTargetManager } from '../../models/bazel-target-manager';
import { BazelTargetCategory, BazelTargetTreeProvider } from '../../ui/bazel-target-tree-provider';

export function registerBazelTargetOperationsCommands(
    context: vscode.ExtensionContext,
    bazelService: BazelService,
    bazelTargetControllerManager: BazelTargetControllerManager,
    bazelTargetManager: BazelTargetManager,
    bazelActionManager: BazelActionManager,
    bazelTreeProvider: BazelTargetTreeProvider
) {
    const bazelTargetOpsController = new BazelTargetOperationsController(
        context,
        bazelService,
        bazelTargetControllerManager,
        bazelTargetManager,
        bazelTreeProvider
    );

    const extensionName = ExtensionUtils.getExtensionName(context);

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.addTarget`, (targetCategory: BazelTargetCategory) => {
        bazelTargetOpsController.pickTargetFromAction(targetCategory.action);
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.addActionAndTarget`, () => {
        bazelActionManager.getActions().then(actions => {
            showQuickPick(actions, (action) => {
                if (action) {
                    bazelTargetOpsController.pickTargetFromAction(action);
                }
            });
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.removeTarget`, (target: BazelTarget) => {
        if (target) {
            bazelTargetOpsController.removeTarget(target);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.copyTarget`, (target: BazelTarget) => {
        if (target) {
            bazelTargetOpsController.copyTarget(target);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.copyCommand`, (target: BazelTarget) => {
        if (target) {
            bazelTargetOpsController.copyCommandToClipboard(target);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.pickTarget`, (target: BazelTarget) => {
        bazelTargetOpsController.pickTarget(target);
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.executeTarget`, (target: BazelTarget) => {
        bazelTargetOpsController.executeTarget(target);
    }));

    ['build', 'run', 'test'].forEach(action => {
        context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.${action}`, () => {
            const selectedTarget = bazelTargetManager.getSelectedTarget(action);
            if (selectedTarget) {
                bazelTargetOpsController.executeTarget(selectedTarget);
            }
        }));
    });
}
