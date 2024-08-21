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
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetManager } from '../../models/bazel-target-manager';
import { ExtensionUtils } from '../../services/extension-utils';
import { BazelTargetCategory } from '../../ui/bazel-target-tree-provider';
import { BazelTargetOperationsController } from '../bazel-target-operations-controller';
import * as vscode from 'vscode';

export function registerBazelTargetOperationsCommands(
    context: vscode.ExtensionContext,
    bazelTargetOpsController: BazelTargetOperationsController,
    bazelTargetManager: BazelTargetManager,
) {


    const extensionName = ExtensionUtils.getExtensionName(context);

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.addTarget`, (targetCategory: BazelTargetCategory) => {
        bazelTargetOpsController.pickTarget(targetCategory.action);
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.addActionAndTarget`, () => {
        bazelTargetOpsController.pickTarget();
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
    }), vscode.commands.registerCommand(`${extensionName}.executingTarget`, () => {
        // Do nothing
    }));

    // Make build, run, and test selected target commands public for hotkey binding
    ['build', 'run', 'test'].forEach(action => {
        context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.${action}`, () => {
            const selectedTarget = bazelTargetManager.getSelectedTarget(action);
            if (selectedTarget) {
                bazelTargetOpsController.executeTarget(selectedTarget);
            }
        }));
    });

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.debug`, () => {
        const selectedTarget = bazelTargetManager.getSelectedTarget('run');
        if (selectedTarget) {
            bazelTargetOpsController.executeTarget(selectedTarget);
        }
    }));
}
