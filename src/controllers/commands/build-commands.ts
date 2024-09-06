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
import { ExtensionUtils } from '../../services/extension-utils';
import { WorkspaceService } from '../../services/workspace-service';
import { BazelTargetQuickPickItem } from '../../ui/bazel-target-quick-pick-item';
import { BazelTargetTreeProvider } from '../../ui/bazel-target-tree-provider';
import { BUILD_RUN_TARGET_STR, BuildController } from '../target-controllers/build-controller';
import * as path from 'path';
import * as vscode from 'vscode';


let currentTargetPath = '';

function pickBuildTarget(context: vscode.ExtensionContext,
    bazelEnvironment: BazelEnvironment,
    bazelTree: BazelTargetTreeProvider)
{
    const extensionName = ExtensionUtils.getExtensionName(context);

    WorkspaceService.getInstance().getSubdirectoryPaths(currentTargetPath.replace('//', ''))
        .then(data => {
            // Prepend current run target option if we are in the root directory
            if (currentTargetPath.trim().length === 0) {
                data.unshift(BUILD_RUN_TARGET_STR);
            }
            return data;
        })
        .then(data => {
            const quickPick = vscode.window.createQuickPick();
            quickPick.items = data.map(label => ({
                label: label,
                detail: label,
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
                        if (typeof res === 'string' && !res.includes('...') && res !== BUILD_RUN_TARGET_STR) {
                            currentTargetPath = res;
                            vscode.commands.executeCommand(`${extensionName}.pickBuildTarget`);
                        } else {
                            currentTargetPath = '';
                            quickPick.hide();
                            bazelEnvironment.updateSelectedBuildTarget(item.target);
                            bazelTree.refresh();
                        }
                    }
                }
            });

            quickPick.show();
        });
}

export function registerBuildCommands(context: vscode.ExtensionContext,
    buildController: BuildController,
    bazelEnvironment: BazelEnvironment,
    bazelTree: BazelTargetTreeProvider) {

    const extensionName = ExtensionUtils.getExtensionName(context);

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.copyBuildCommand`, (target: BazelTarget) => {

        buildController.getExecuteCommand(target).then(result => {
            vscode.env.clipboard.writeText(result || '');

            vscode.window.showInformationMessage('Copied to clipboard');
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.pickBuildTarget`, () => {
        pickBuildTarget(context, bazelEnvironment, bazelTree);
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