/////////////////////////////////////////////////////////////////////////////////////////
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
/////////////////////////////////////////////////////////////////////////////////////////

import { BazelActionManager } from '../models/bazel-action-manager';
import { BazelTarget } from '../models/bazel-target';
import { BazelTargetManager } from '../models/bazel-target-manager';
import { ExtensionUtils } from '../services/extension-utils';
import * as vscode from 'vscode';

export class BazelTargetTreeProvider implements vscode.TreeDataProvider<BazelTarget> {
    private _onDidChangeTreeData: vscode.EventEmitter<BazelTarget | undefined | void> = new vscode.EventEmitter<BazelTarget | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<BazelTarget | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext,
        private readonly bazelTargetManager: BazelTargetManager,
        private readonly bazelActionManager: BazelActionManager
    ) {}

    /**
     * Convert the templated BazelTarget into a display item for the tree.
     * Because the TreeDataProvider is templated and BazelTarget is the template
     * param, this function must be present to convert from the template
     * param (BazelTarget) to a display item in the tree (vscode.TreeItem).
     * @param element The instance of a BazelTarget.
     * @returns A TreeItem for display in the tree.
     */
    public getTreeItem(element: BazelTarget): vscode.TreeItem {
        const extensionName = ExtensionUtils.getExtensionName(this.context);
        const treeItem = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = element.action;
        treeItem.iconPath = new vscode.ThemeIcon('tools'); // Icon customization based on action
        treeItem.command = {
            command: `${extensionName}.${element.action}`,
            title: `${element.action} ${element.label}`,
            arguments: [element]
        };
        return treeItem;
    }

    // Method to get root-level children (e.g., bazel targets)
    private getRootChildren(): Thenable<BazelTarget[]> {
        const bazelTargets = this.bazelTargetManager.getTargets();
        return Promise.resolve(bazelTargets);
    }

    // Method to get children of a specific element (e.g., bazel target properties)
    private getChildrenForElement(element: BazelTarget): Thenable<BazelTarget[]> {
        // Logic to get children for the given element

        return Promise.resolve([
            // new BazelTarget('sub-build', 'build'),
            // new BazelTarget('sub-test', 'test')
        ]);
    }


    // The getChildren method to fetch either root elements or child elements
    getChildren(element?: BazelTarget): Thenable<BazelTarget[]> {
        if (element === undefined) {
            // No element provided, return the root-level elements
            return this.getRootChildren();
        } else {
            // Element provided, return the children of this element
            return this.getChildrenForElement(element);
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}