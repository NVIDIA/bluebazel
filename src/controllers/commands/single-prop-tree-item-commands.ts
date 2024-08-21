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

import { BazelTargetProperty } from '../../models/bazel-target-property';
import { ExtensionUtils } from '../../services/extension-utils';
import { BazelTargetTreeProvider } from '../../ui/bazel-target-tree-provider';
import { showQuickPick } from '../../ui/quick-pick';
import * as vscode from 'vscode';

export function registerSinglePropTreeItemCommands(context: vscode.ExtensionContext, treeDataProvider: BazelTargetTreeProvider) {
    const extensionName = ExtensionUtils.getExtensionName(context);
    context.subscriptions.push(
        vscode.commands.registerCommand(`${extensionName}.copySinglePropTreeItem`, (property: BazelTargetProperty) => {
            vscode.env.clipboard.writeText(property.get());
        }),
        vscode.commands.registerCommand(`${extensionName}.editSinglePropTreeItem`, (property: BazelTargetProperty) => {
            const data: string[] = property.getHistory();
            showQuickPick(data, (data: string) => {
                property.update(data);
                treeDataProvider.refresh();
            });
        })
    );
}