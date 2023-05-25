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
import * as vscode from 'vscode';
import * as path from 'path';

import * as common from './common';
import { BazelController as BazelController } from './controller';
import { BazelModel } from './model';
import { BazelTreeDataProvider } from './treeView';

let currentTargetPath = '';

function pickBuildTarget(bazelController: BazelController,
    bazelModel: BazelModel,
    bazelTree: BazelTreeDataProvider)
{
    bazelController.getPaths(currentTargetPath.replace('//', ''))
        .then(data => {
            // Prepend current run target option if we are in the root directory
            if (currentTargetPath.trim().length === 0) {
                data.unshift(common.BUILD_RUN_TARGET_STR);
            }
            return data;
        })
        .then(data => {
            const quickPick = vscode.window.createQuickPick();
            quickPick.items = data.map(label => ({ label }));
            if (currentTargetPath.trim().length !== 0) {
                quickPick.buttons = [vscode.QuickInputButtons.Back];
                quickPick.onDidTriggerButton(item => {
                    if (item === vscode.QuickInputButtons.Back) {
                        currentTargetPath = path.dirname(currentTargetPath);
                        vscode.commands.executeCommand('bluebazel.pickBuildTarget');
                    }
                });
            }

            quickPick.onDidChangeSelection(value => {
                currentTargetPath = '';
                if (value[0]) {
                    const res = value[0].label;
                    if (res !== undefined) {
                        if (typeof res === 'string' && !res.includes('...') && res !== common.BUILD_RUN_TARGET_STR) {
                            currentTargetPath = res;
                            vscode.commands.executeCommand('bluebazel.pickBuildTarget');
                        } else {
                            currentTargetPath = '';
                            quickPick.hide();
                            bazelModel.update(common.WORKSPACE_KEYS.buildTarget, { label: res, value: res });
                            bazelTree.refresh();
                        }
                    }
                }
            });

            quickPick.show();
        });
}


export function registerBuildCommands(context: vscode.ExtensionContext,
    bazelController: BazelController,
    bazelModel: BazelModel,
    bazelTree: BazelTreeDataProvider) {

    context.subscriptions.push(vscode.commands.registerCommand('bluebazel.pickBuildTarget', () => {
        pickBuildTarget(bazelController, bazelModel, bazelTree);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('bluebazel.format', () => {
        bazelController.format();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('bluebazel.buildCurrentFile', () => {
        bazelController.buildSingle();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('bluebazel.build', () => {
        const target = bazelModel.getTarget(common.TargetType.BUILD).value;
        if (!target) {
            vscode.commands.executeCommand('bluebazel.pickBuildTarget', (target: string) => {
                bazelController.buildTarget(target);
            });
        } else {
            bazelController.buildTarget(target);
        }
    }));
}