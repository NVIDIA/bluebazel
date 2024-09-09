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
import { LaunchConfigService as LaunchConfigService } from '../../services/launch-config-service';
import { BazelTargetTreeProvider } from '../../ui/bazel-target-tree-provider';
import { RunController } from '../target-controllers/run-controller';
import * as vscode from 'vscode';


export function registerRunCommands(context: vscode.ExtensionContext,
    runController: RunController,
    launchConfigService: LaunchConfigService,
    bazelEnvironment: BazelEnvironment,
    bazelTree: BazelTargetTreeProvider) {

    const extensionName = ExtensionUtils.getExtensionName(context);
    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.copyRunCommand`, (target: BazelTarget) => {
        runController.getExecuteCommand(target).then(result => {
            vscode.env.clipboard.writeText(result || '');

            vscode.window.showInformationMessage('Copied to clipboard');
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.pickRunTarget`, (target: BazelTarget) => {
        runController.getRunTargets()
            .then(data => vscode.window.showQuickPick(data))
            .then(res => {
                if (res !== undefined && res.detail !== undefined) {
                    bazelEnvironment.updateSelectedRunTarget(res.target);
                    launchConfigService.refreshLaunchConfigs(res.target);
                    bazelTree.refresh();
                }
            })
            .catch(err => vscode.window.showErrorMessage(err));
    }));

    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.run`, (target: BazelTarget) => {
        if (!target) {
            vscode.commands.executeCommand(`${extensionName}.pickRunTarget`, (target: BazelTarget) => {
                runController.execute(target);
            });
        } else {
            runController.execute(target);
        }
    }));
}