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

import * as vscode from 'vscode';
import { BazelTarget } from '../models/bazel-target';
import { BazelTargetController } from '../controllers/target-controllers/bazel-target-controller';

export class BazelTargetTreeProvider implements vscode.TreeDataProvider<BazelTarget> {
    private _onDidChangeTreeData: vscode.EventEmitter<BazelTarget | undefined | void> = new vscode.EventEmitter<BazelTarget | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<BazelTarget | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private controller: BazelTargetController) {}

    getTreeItem(element: BazelTarget): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = element.action;
        treeItem.iconPath = new vscode.ThemeIcon('tools'); // Icon customization based on action
        treeItem.command = {
            command: 'bazelTasks.buildTarget',
            title: 'Build Bazel Target',
            arguments: [element]
        };
        return treeItem;
    }

    // Method to get root-level children (e.g., directories)
    private getRootChildren(): Thenable<BazelTarget[]> {
        // Logic to get the root-level elements
        return Promise.resolve([
            new BazelTarget('build', 'build'),
            new BazelTarget('test', 'test')
        ]);
    }

    // Method to get children of a specific element (e.g., files within a directory)
    private getChildrenForElement(element: BazelTarget): Thenable<BazelTarget[]> {
        // Logic to get children for the given element
        return Promise.resolve([
            new BazelTarget('sub-build', 'build'),
            new BazelTarget('sub-test', 'test')
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