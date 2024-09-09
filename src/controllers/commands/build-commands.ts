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
import { BazelEnvironment } from '../../models/bazel-environment';
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetManager } from '../../models/bazel-target-manager';
import { BazelService } from '../../services/bazel-service';
import { ExtensionUtils } from '../../services/extension-utils';
import { WorkspaceService } from '../../services/workspace-service';
import { BazelTargetQuickPickItem } from '../../ui/bazel-target-quick-pick-item';
import { BazelTargetTreeProvider } from '../../ui/bazel-target-tree-provider';
import { BUILD_RUN_TARGET_STR, BuildController } from '../target-controllers/build-controller';
import * as path from 'path';
import * as vscode from 'vscode';


let currentTargetPath = '';

async function pickBuildTarget(context: vscode.ExtensionContext,
    bazelEnvironment: BazelEnvironment,
    bazelTargetManager: BazelTargetManager,
    bazelTree: BazelTargetTreeProvider,
    currentTarget?: BazelTarget)
{
    const extensionName = ExtensionUtils.getExtensionName(context);

    const targetList = await WorkspaceService.getInstance().getSubdirectoryPaths(currentTargetPath.replace('//', ''));
    // Prepend current run target option if we are in the root directory
    if (currentTargetPath.trim().length === 0) {
        targetList.unshift(BUILD_RUN_TARGET_STR);
    }

    const dirBuildTargets = await BazelService.fetchBuildTargets(
        currentTargetPath,
        WorkspaceService.getInstance().getWorkspaceFolder().uri.path
    );

    // Add each target to the data array
    dirBuildTargets.forEach(targetName => {
        targetList.push(`//${currentTargetPath}:${targetName}`);
    });

    const quickPick = vscode.window.createQuickPick();
    quickPick.items = targetList.map(label => ({
        label: label,
        // Leave out 'detail' key here as it would be redundant to label
        target: new BazelTarget(context, label, label, 'build')
    } as BazelTargetQuickPickItem));
    if (currentTargetPath.trim().length !== 0) {
        quickPick.buttons = [vscode.QuickInputButtons.Back];
        quickPick.onDidTriggerButton(item => {
            if (item === vscode.QuickInputButtons.Back) {
                currentTargetPath = path.dirname(currentTargetPath);
                vscode.commands.executeCommand(`${extensionName}.pickBuildTarget`);
            }
        });
    }

    quickPick.onDidChangeSelection(value => {
        currentTargetPath = '';
        if (value[0]) {
            const item = value[0] as BazelTargetQuickPickItem;
            const res = item.label;
            if (res !== undefined) {
                if (typeof res === 'string' && !res.includes('...') && res !== BUILD_RUN_TARGET_STR && !res.includes(':') ) {
                    currentTargetPath = res;
                    vscode.commands.executeCommand(`${extensionName}.pickBuildTarget`, [item.target]);
                } else {
                    currentTargetPath = '';
                    quickPick.hide();
                    if (currentTarget) {
                        bazelTargetManager.removeTarget(currentTarget);
                    }
                    bazelTargetManager.addTarget(item.target);
                    // bazelEnvironment.updateSelectedBuildTarget(item.target);
                    bazelTree.refresh();
                }
            }
        }
    });

    quickPick.show();
}

export function registerBuildCommands(context: vscode.ExtensionContext,
    buildController: BuildController,
    bazelEnvironment: BazelEnvironment,
    bazelTargetManager: BazelTargetManager,
    bazelTree: BazelTargetTreeProvider) {

    const extensionName = ExtensionUtils.getExtensionName(context);

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.copyBuildCommand`, (target: BazelTarget) => {

        buildController.getExecuteCommand(target).then(result => {
            vscode.env.clipboard.writeText(result || '');

            vscode.window.showInformationMessage('Copied to clipboard');
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.pickBuildTarget`, (target?: BazelTarget) => {
        pickBuildTarget(context, bazelEnvironment, bazelTargetManager, bazelTree, target);
    }));


    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.build`, (target: BazelTarget) => {
        if (!target) {
            vscode.commands.executeCommand(`${extensionName}.pickBuildTarget`, (target: BazelTarget) => {
                buildController.execute(target);
            });
        } else {
            buildController.execute(target);
        }
    }));
}