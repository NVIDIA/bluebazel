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
import { BazelAction, BazelTarget } from '../models/bazel-target';
import { BazelTargetManager } from '../models/bazel-target-manager';
import { BazelTargetMultiProperty, BazelTargetMultiPropertyItem } from '../models/bazel-target-multi-property';
import { BazelTargetProperty } from '../models/bazel-target-property';
import * as vscode from 'vscode';

type BazelTreeElement = BazelTargetCategory | BazelTarget | BazelTargetMultiProperty | BazelTargetProperty | BazelTargetMultiPropertyItem;

export class BazelTargetCategory  {
    public readonly id: string;
    constructor(public readonly action: BazelAction) {
        this.id = action;
    }
}

export class BazelTargetTreeProvider implements vscode.TreeDataProvider<BazelTreeElement> {
    private _onDidChangeTreeData: vscode.EventEmitter<BazelTreeElement | undefined | void> = new vscode.EventEmitter<BazelTreeElement | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<BazelTreeElement | undefined | void> = this._onDidChangeTreeData.event;

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

    private getIcon(element: BazelTarget | BazelTargetCategory): vscode.ThemeIcon {
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

    private getActionOrder(action: string): number {
        return this.actionOrder[action] || 99; // Assign default priority for unknown actions
    }

    private getRootChildren(): Thenable<BazelTargetCategory[]> {
        // Get BazelActions and map them to BazelTargetCategory
        const bazelActions: BazelAction[] = this.bazelTargetManager.getTargetActions();

        // Map each BazelAction to BazelTargetCategory
        const bazelTargetCategories = bazelActions.map(action => new BazelTargetCategory(action));

        // Sort the BazelTargetCategory based on the predefined action order
        bazelTargetCategories.sort((a, b) => {
            const orderA = this.getActionOrder(a.action);
            const orderB = this.getActionOrder(b.action);
            return orderA - orderB; // Ascending order: lower number means higher priority
        });

        // Return the sorted categories as a resolved Promise
        return Promise.resolve(bazelTargetCategories);
    }

    private getChildrenForBazelTargetCategory(category: BazelTargetCategory): Thenable<BazelTarget[]> {
        return Promise.resolve(this.bazelTargetManager.getTargets(category.action));
    }

    private getChildrenForBazelTarget(target: BazelTarget): Thenable<(BazelTargetProperty | BazelTargetMultiProperty)[]> {
        const properties = [
            target.getEnvVars(),
            target.getConfigArgs(),
            target.getBazelArgs(),
            target.getRunArgs()
        ];

        return Promise.resolve(properties);
    }

    private getChildrenForBazelTargetProperty(property: BazelTargetMultiProperty): Thenable<BazelTargetMultiPropertyItem[]> {
        return Promise.resolve(property.get());
    }

    // Method to get children of a specific element (e.g., bazel target properties)
    private getChildrenForElement(element: BazelTreeElement): Thenable<(BazelTarget | BazelTargetProperty | BazelTargetMultiProperty | BazelTargetMultiPropertyItem)[]> {
        if (element instanceof BazelTargetCategory) {
            return this.getChildrenForBazelTargetCategory(element);
        } else if (element instanceof BazelTarget) {
            return this.getChildrenForBazelTarget(element);
        } else if (element instanceof BazelTargetMultiProperty) {
            return this.getChildrenForBazelTargetProperty(element);
        } else {
            // Any other type has no children
            return Promise.resolve([]);
        }
    }

    // The getChildren method to fetch either root elements or child elements
    getChildren(element?: BazelTreeElement): Thenable<BazelTreeElement[]> {
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

    private getTargetCategoryTreeItem(element: BazelTargetCategory): vscode.TreeItem {
        const isExpanded = this.getExpandedState(element.action);
        const collapsibleState = isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;

        const treeItem = new vscode.TreeItem(`${this.capitalizeFirstLetter(element.action)}`, collapsibleState);
        treeItem.contextValue = `${element.action}Category`;
        treeItem.iconPath = this.getIcon(element); // Icon customization based on action
        return treeItem;
    }
    /**
     * Converts a BazelTarget into a display item for the tree.
     */
    private getTargetTreeItem(element: BazelTarget): vscode.TreeItem {
        const isExpanded = this.getExpandedState(element.id);
        const collapsibleState = isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;

        const treeItem = new vscode.TreeItem(element.label, collapsibleState);
        treeItem.contextValue = `${element.action}Target`;
        treeItem.label = `${element.label}`;
        return treeItem;
    }

    // Converts BazelTargetProperty into a tree item
    private getPropertyTreeItem(property: BazelTargetProperty): vscode.TreeItem {
        const item = new vscode.TreeItem(property.label + ' ' + property.get(), vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'SinglePropTreeItem';
        return item;
    }

    private getMultiPropertyTreeItem(property: BazelTargetMultiProperty): vscode.TreeItem {
        const isExpanded = this.getExpandedState(property.id);
        let collapsibleState = isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
        if (property.toStringArray().length == 0) {
            collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        const item = new vscode.TreeItem(property.label, collapsibleState);
        item.contextValue = 'MultiPropTreeItem';
        return item;
    }

    private getPropertyChildTreeItem(propertyItem: BazelTargetMultiPropertyItem): vscode.TreeItem {
        const item = new vscode.TreeItem(propertyItem.get(), vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'MultiPropTreeItemChild';
        return item;
    }

    getTreeItem(element: BazelTreeElement): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (element instanceof BazelTargetCategory) {
            return Promise.resolve(this.getTargetCategoryTreeItem(element));
        } else if (element instanceof BazelTarget) {
            return Promise.resolve(this.getTargetTreeItem(element));
        } else if (element instanceof BazelTargetProperty) {
            return Promise.resolve(this.getPropertyTreeItem(element));
        } else if (element instanceof BazelTargetMultiProperty) {
            return Promise.resolve(this.getMultiPropertyTreeItem(element));
        } else {
            return Promise.resolve(this.getPropertyChildTreeItem(element));
        }

    }

    // Store the expanded/collapsed state in workspaceState
    private setExpandedState(itemId: string, isExpanded: boolean) {
        const state = this.context.workspaceState.get<{ [key: string]: boolean }>('expandedState', {});
        state[itemId] = isExpanded;
        this.context.workspaceState.update('expandedState', state);
    }

    // Get the expanded/collapsed state for a given item
    private getExpandedState(itemId: string): boolean {
        const state = this.context.workspaceState.get<{ [key: string]: boolean }>('expandedState', {});
        return state[itemId] || false; // Default to collapsed if not stored
    }

    private getTreeItemModelId(element: BazelTreeElement): string {
        return element.id;
    }
    // Update the state when a tree item is expanded/collapsed
    onDidExpandElement(event: vscode.TreeViewExpansionEvent<BazelTreeElement>) {
        const id = this.getTreeItemModelId(event.element);
        this.setExpandedState(id, true);
    }

    onDidCollapseElement(event: vscode.TreeViewExpansionEvent<BazelTreeElement>) {
        const id = this.getTreeItemModelId(event.element);
        this.setExpandedState(id, false);
    }

    // To register the expansion/collapse listeners:
    registerTreeViewListeners(treeView: vscode.TreeView<BazelTreeElement>) {
        treeView.onDidExpandElement(this.onDidExpandElement, this);
        treeView.onDidCollapseElement(this.onDidCollapseElement, this);
    }
}