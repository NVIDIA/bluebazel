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

import * as common from './common';
import { BazelController as BazelController } from './controller';
import { BazelModel } from './model';
import { BazelTreeDataProvider } from './treeView';

export function registerRunCommands(context: vscode.ExtensionContext,
    bazelController: BazelController,
    bazelModel: BazelModel,
    bazelTree: BazelTreeDataProvider) {

    context.subscriptions.push(vscode.commands.registerCommand('bluebazel.copyRunCommand', () => {
        const target = bazelModel.getTarget(common.TargetType.RUN).value;

        bazelController.getRunCommand(target).then((value) => {
            vscode.env.clipboard.writeText(value || '');
            vscode.window.showInformationMessage('Copied to clipboard');
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('bluebazel.pickRunTarget', () => {
        bazelController.getRunTargets()
            .then(data => vscode.window.showQuickPick(data))
            .then(res => {
                if (res !== undefined && res.detail !== undefined) {
                    bazelModel.update(common.WORKSPACE_KEYS.runTarget, { label: res.label, value: res.detail });
                    bazelController.refreshLaunchConfigs(res.detail);
                    bazelTree.refresh();
                }
            })
            .catch(err => vscode.window.showErrorMessage(err));
    }));

    context.subscriptions.push(vscode.commands.registerCommand('bluebazel.refreshRunTargets', () => {
        bazelController.refreshRunTargets()
            .then(() => { /* Nothing to do */ })
            .catch(err => vscode.window.showErrorMessage(err));
    }));

    context.subscriptions.push(vscode.commands.registerCommand('bluebazel.run', () => {
        const target = bazelModel.getTarget(common.TargetType.RUN).value;
        if (!target) {
            vscode.commands.executeCommand('bluebazel.pickRunTarget', (target: string) => {
                bazelController.run(target);
            });
        } else {
            bazelController.run(target);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('bluebazel.debug', () => {
        const runTarget = bazelModel.getTarget(common.TargetType.RUN).value;
        bazelController.debug(runTarget);
    }));

}