/////////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2023 NVIDIA Corporation
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
import { BazelActionManager } from '../../models/bazel-action-manager';
import { BazelAction, BazelTarget } from '../../models/bazel-target';
import { BazelTargetManager } from '../../models/bazel-target-manager';
import { BazelService } from '../../services/bazel-service';
import { ExtensionUtils } from '../../services/extension-utils';
import { BazelTargetCategory, BazelTargetTreeProvider } from '../../ui/bazel-target-tree-provider';
import { showQuickPick } from '../../ui/quick-pick';
import { BazelTargetControllerManager } from '../target-controllers/bazel-target-controller-manager';
import * as vscode from 'vscode';

function pickTargetFromAction(context: vscode.ExtensionContext,
    bazelService: BazelService,
    action: BazelAction,
    bazelTargetControllerManager: BazelTargetControllerManager) {
    const target = new BazelTarget(context, bazelService, '', '', action);
    const controller = bazelTargetControllerManager.getController(action);
    if (controller === undefined) {
        vscode.window.showErrorMessage(`There are no controllers for the action ${target.action}`);
        return;
    }
    controller.pickTarget(target);
}

export function registerTargetCommands(context: vscode.ExtensionContext,
    bazelService: BazelService,
    bazelTargetControllerManager: BazelTargetControllerManager,
    bazelTargetManager: BazelTargetManager,
    bazelActionManager: BazelActionManager,
    bazelTreeProvider: BazelTargetTreeProvider
) {

    const extensionName = ExtensionUtils.getExtensionName(context);

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.addTarget`, (targetCategory: BazelTargetCategory) => {
        pickTargetFromAction(context, bazelService, targetCategory.action, bazelTargetControllerManager);
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.addActionAndTarget`, () => {
        bazelActionManager.getActions().then(actions => {
            showQuickPick(actions, (action) => {
                if (action !== undefined) {
                    pickTargetFromAction(context, bazelService, action, bazelTargetControllerManager);
                }
            });
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.removeTarget`, (target: BazelTarget) => {
        if (target === undefined) {
            return;
        }
        bazelTargetManager.removeTarget(target);
        bazelTreeProvider.refresh();
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.copyCommand`, (target: BazelTarget) => {

        if (target === undefined) {
            return;
        }
        const controller = bazelTargetControllerManager.getController(target.action);
        if (controller === undefined) {
            console.error(`Target controller undefined for action ${target.action}`);
            return;
        }
        controller.getExecuteCommand(target).then(result => {
            vscode.env.clipboard.writeText(result || '');

            vscode.window.showInformationMessage('Copied to clipboard');
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.pickTarget`, (target: BazelTarget) => {

        const controller = bazelTargetControllerManager.getController(target.action);
        if (controller === undefined) {
            console.error(`Target controller undefined for action ${target.action}`);
            return;
        }
        controller.pickTarget(target);
    }));


    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.executeTarget`, (target: BazelTarget) => {
        const controller = bazelTargetControllerManager.getController(target.action);
        if (controller === undefined) {
            console.error(`Target controller undefined for action ${target.action}`);
            return;
        }
        controller.execute(target);
    }));
}