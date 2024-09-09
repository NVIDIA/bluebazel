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

import { MultiPropTreeItem } from './multi-prop-tree-item';
import { SinglePropTreeItem } from './single-prop-tree-item';
import { BazelActionManager } from '../models/bazel-action-manager';
import { BazelAction, BazelTarget } from '../models/bazel-target';
import { BazelTargetManager } from '../models/bazel-target-manager';
import { BazelTargetProperty } from '../models/bazel-target-property';
import * as vscode from 'vscode';

class BazelTargetTreeItem extends vscode.TreeItem {
    constructor(public target: BazelTarget, label: string | vscode.TreeItemLabel, collapsibleState?: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
    }
}

export class BazelTargetTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<BazelTarget | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

    // Define a map of BazelAction to vscode.ThemeIcon
    private iconMap: Map<BazelAction, vscode.ThemeIcon> = new Map([
        ['analyze-profile', new vscode.ThemeIcon('pulse')],     // 'pulse' for performance-related analysis
        ['aquery', new vscode.ThemeIcon('search')],             // 'search' for query actions
        ['build', new vscode.ThemeIcon('tools')],               // 'tools' for building
        ['canonicalize-flags', new vscode.ThemeIcon('symbol-key')], // 'symbol-key' for canonicalizing flags/options
        ['clean', new vscode.ThemeIcon('trash')],               // 'trash' for cleaning
        ['coverage', new vscode.ThemeIcon('shield')],           // 'shield' for code coverage
        ['cquery', new vscode.ThemeIcon('search')],             // 'search' for configuration queries
        ['dump', new vscode.ThemeIcon('archive')],              // 'archive' for dumping internal states
        ['fetch', new vscode.ThemeIcon('cloud-download')],      // 'cloud-download' for fetching external dependencies
        ['help', new vscode.ThemeIcon('question')],             // 'question' for help
        ['info', new vscode.ThemeIcon('info')],                 // 'info' for runtime information
        ['license', new vscode.ThemeIcon('law')],               // 'law' for license information
        ['mobile-install', new vscode.ThemeIcon('device-mobile')], // 'device-mobile' for mobile installations
        ['mod', new vscode.ThemeIcon('circuit-board')],         // 'circuit-board' for external dependency graph (module-related)
        ['print_action', new vscode.ThemeIcon('terminal')],     // 'terminal' for printing compilation arguments
        ['query', new vscode.ThemeIcon('graph')],               // 'graph' for dependency graph query
        ['run', new vscode.ThemeIcon('play')],                  // 'play' for running targets
        ['shutdown', new vscode.ThemeIcon('stop-circle')],      // 'stop-circle' for stopping the server
        ['sync', new vscode.ThemeIcon('sync')],                 // 'sync' for syncing repositories
        ['test', new vscode.ThemeIcon('beaker')],               // 'beaker' for testing
        ['version', new vscode.ThemeIcon('tag')],               // 'tag' for version information
    ]);

    // Default icon in case the action does not match any known action
    private defaultIcon: vscode.ThemeIcon = new vscode.ThemeIcon('question');

    constructor(private context: vscode.ExtensionContext,
        private readonly bazelTargetManager: BazelTargetManager,
        private readonly bazelActionManager: BazelActionManager
    ) {}

    private getIcon(element: BazelTarget): vscode.ThemeIcon {
        // Return the icon based on the action, defaulting to the 'question' icon
        return this.iconMap.get(element.action) || this.defaultIcon;
    }

    private capitalizeFirstLetter(str: string): string {
        if (str === undefined) {
            return '';
        }

        if (str.length < 1) {
            return str;
        }
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Sort order: prioritize build, run, test, then everything else
    private actionOrder: { [key: string]: number } = {
        'build': 1,
        'run': 2,
        'debug': 3,
        'test': 4,
        'query': 5,
        // Any other actions have lower priority by default
    };

    // Assign a default priority for actions not in the map
    private getActionOrder(action: string): number {
        return this.actionOrder[action] || 99;
    }

    // Method to get root-level children (e.g., bazel targets)
    private getRootChildren(): Thenable<vscode.TreeItem[]> {
        const bazelTargets = this.bazelTargetManager.getTargets();
        // Sort targets based on the action order
        bazelTargets.sort((a, b) => {
            const orderA = this.getActionOrder(a.action);
            const orderB = this.getActionOrder(b.action);
            return orderA - orderB; // Sort ascending: lower number means higher priority
        });

        // Convert targets to tree items
        const treeItems = bazelTargets.map(target => this.getTargetTreeItem(target));
        return Promise.resolve(treeItems);
    }

    /**
     * Converts a BazelTarget into a display item for the tree.
     */
    private getTargetTreeItem(element: BazelTarget): vscode.TreeItem {
        const collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        const treeItem = new BazelTargetTreeItem(element, element.label, collapsibleState);
        treeItem.contextValue = element.action;
        treeItem.iconPath = this.getIcon(element); // Icon customization based on action
        treeItem.label = `${this.capitalizeFirstLetter(element.action)} ${element.detail}`;
        return treeItem;
    }

    // Converts BazelTargetProperty into a tree item
    private getPropertyTreeItem(property: BazelTargetProperty): vscode.TreeItem {
        const updateTree = () => { this.refresh(); };
        let item: vscode.TreeItem;
        switch (property.name) {
        case 'EnvVars':
        case 'ConfigArgs':
        case 'BazelArgs':
            item = new MultiPropTreeItem(this.context, property.label, property, updateTree);
            break;
        case 'RunArgs':
            item = new SinglePropTreeItem(this.context, property.label, property, updateTree);
            break;
        default:
            throw Error(`No such BazelTargetProperty with name ${property.name}`);
        }
        return item;
    }

    private getChildrenForBazelTarget(element: BazelTarget): Thenable<vscode.TreeItem[]> {
        const properties = [
            element.getEnvVars(),
            element.getConfigArgs(),
            element.getBazelArgs(),
            element.getRunArgs()
        ];

        // Convert each BazelTargetProperty into a TreeItem
        const propertyTreeItems = properties.map(prop => this.getPropertyTreeItem(prop));

        return Promise.resolve(propertyTreeItems);
    }

    private getChildrenForMultiPropTreeItem(element: MultiPropTreeItem): Thenable<vscode.TreeItem[]> {
        return Promise.resolve(element.getChildren());
    }

    // Method to get children of a specific element (e.g., bazel target properties)
    private getChildrenForElement(element: BazelTarget | MultiPropTreeItem): Thenable<vscode.TreeItem[]> {
        if (element instanceof BazelTargetTreeItem) {
            return this.getChildrenForBazelTarget(element.target);
        } else if (element instanceof MultiPropTreeItem) {
            return this.getChildrenForMultiPropTreeItem(element);
        } else {
            // Any other type has no children
            return Promise.resolve([]);
        }
    }

    // The getChildren method to fetch either root elements or child elements
    getChildren(element?: BazelTarget | MultiPropTreeItem): Thenable<vscode.TreeItem[]> {
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

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
}