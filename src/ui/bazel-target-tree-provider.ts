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

import { BazelAction, BazelTarget } from '../models/bazel-target';
import { BazelTargetManager } from '../models/bazel-target-manager';
import { BazelTargetMultiProperty, BazelTargetMultiPropertyItem } from '../models/bazel-target-multi-property';
import { BazelTargetProperty } from '../models/bazel-target-property';
import { BazelTargetState, BazelTargetStateManager } from '../models/bazel-target-state-manager';
import { ConfigurationManager, UserCustomButton, UserCustomCategory as UserCustomCategory } from '../services/configuration-manager';
import { ExtensionUtils } from '../services/extension-utils';
import * as vscode from 'vscode';

export type BazelTreeElement = BazelTargetCategory | BazelTarget | BazelTargetMultiProperty | BazelTargetProperty | BazelTargetMultiPropertyItem | UserCustomCategory | UserCustomButton;

export class BazelTargetCategory {
    public readonly id: string;
    constructor(public readonly action: BazelAction) {
        this.id = action;
    }
}

export class BazelTargetTreeProvider implements vscode.TreeDataProvider<BazelTreeElement> {
    private _onDidChangeTreeData: vscode.EventEmitter<BazelTreeElement | undefined | void> = new vscode.EventEmitter<BazelTreeElement | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<BazelTreeElement | undefined | void> = this._onDidChangeTreeData.event;

    private expandedStateCache: { [key: string]: boolean } = {};

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
        private readonly configurationManager: ConfigurationManager,
        private readonly bazelTargetManager: BazelTargetManager,
        private readonly bazelTargetStateManager: BazelTargetStateManager
    ) {
        // Load expanded state into memory at startup
        const savedState = this.context.workspaceState.get<{ [key: string]: boolean }>('expandedState', {});
        this.expandedStateCache = savedState || {};

        // Subscribe to target state changes
        this.bazelTargetStateManager.onDidChangeTargetState(() => {
            // Refresh the tree whenever a target state changes
            this.refresh();
        });
    }

    private debouncedSaveExpandedState = this.debounce(() => {
        this.context.workspaceState.update('expandedState', this.expandedStateCache);
    }, 500);  // Save after 500ms of inactivity

    public expandTarget(target: BazelTarget): void {
        // Expand the parent category
        const parentCategoryId = target.action; // Assuming 'action' is the identifier for the parent category
        this.setExpandedState(parentCategoryId, true);

        // Expand the target itself
        this.setExpandedState(target.id, true);

        // Refresh the tree view so the expanded state is reflected
        this.refresh();
    }

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

    private getRootChildren(): Promise<(BazelTargetCategory | UserCustomCategory)[]> {
        return new Promise(resolve => {
            // Get BazelActions and map them to BazelTargetCategory
            const bazelActions: BazelAction[] = this.bazelTargetManager.getTargetActions();

            // Set the context based on whether specific elements exist
            vscode.commands.executeCommand('setContext', `${ExtensionUtils.getExtensionName(this.context)}.bazelTreeActions`, bazelActions.join('|'));

            // Map each BazelAction to BazelTargetCategory
            const bazelTargetCategories = bazelActions.map(action => new BazelTargetCategory(action));

            // Sort the BazelTargetCategory based on the predefined action order
            bazelTargetCategories.sort((a, b) => {
                const orderA = this.getActionOrder(a.action);
                const orderB = this.getActionOrder(b.action);
                return orderA - orderB; // Ascending order: lower number means higher priority
            });

            // Get custom user buttons
            const customButtons = this.configurationManager.getCustomButtons();

            // Return the sorted categories as a resolved Promise
            return resolve([...bazelTargetCategories, ...customButtons]);
        });
    }

    private getChildrenForBazelTargetCategory(category: BazelTargetCategory): BazelTarget[] {
        return this.bazelTargetManager.getTargets(category.action);
    }

    private getChildrenForBazelTarget(target: BazelTarget): (BazelTargetProperty | BazelTargetMultiProperty)[] {
        const properties = [
            target.getEnvVars(),
            target.getConfigArgs(),
            target.getBazelArgs(),
            target.getRunArgs()
        ];

        return properties;
    }

    private getChildrenForBazelTargetProperty(property: BazelTargetMultiProperty): BazelTargetMultiPropertyItem[] {
        return property.get();
    }

    private getChildrenForUserCustomCategory(userCategory: UserCustomCategory): UserCustomButton[] {
        return userCategory.buttons;
    }

    // Method to get children of a specific element (e.g., bazel target properties)
    private getChildrenForElement(element: BazelTreeElement): Promise<(BazelTarget | BazelTargetProperty | BazelTargetMultiProperty | BazelTargetMultiPropertyItem | UserCustomButton)[]> {
        return new Promise(resolve => {
            if (element instanceof BazelTargetCategory) {
                return resolve(this.getChildrenForBazelTargetCategory(element));
            } else if (element instanceof BazelTarget) {
                return resolve(this.getChildrenForBazelTarget(element));
            } else if (element instanceof BazelTargetMultiProperty) {
                return resolve(this.getChildrenForBazelTargetProperty(element));
            } else if (element instanceof UserCustomCategory) {
                return resolve(this.getChildrenForUserCustomCategory(element));
            } else {
                // Any other type has no children
                return resolve([]);
            }
        });
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

    private debounce(func: (...args: unknown[]) => void, delay: number) {
        let timeoutId: NodeJS.Timeout;

        return function (this: any, ...args: unknown[]) {  // Preserve 'this' context and pass the args
            clearTimeout(timeoutId);  // Clear the previous timer if the function is called again
            timeoutId = setTimeout(() => {
                func.apply(this, args);  // Call the original function after the delay
            }, delay);
        };
    }

    private debouncedRefresh = this.debounce(() => {
        this._onDidChangeTreeData.fire();  // The actual refresh logic
    }, 300);

    public refresh() {
        this.debouncedRefresh();
    }

    private getTargetCategoryTreeItem(element: BazelTargetCategory): vscode.TreeItem {
        const isExpanded = this.getExpandedState(element.action);
        const collapsibleState = isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;

        const treeItem = new vscode.TreeItem(`${this.capitalizeFirstLetter(element.action)}`, collapsibleState);
        treeItem.contextValue = `${element.action}Category`;
        treeItem.iconPath = this.getIcon(element); // Icon customization based on action
        return treeItem;
    }

    private formatTargetContextValue(target: BazelTarget, targetState: BazelTargetState) {
        return `${target.action}${this.capitalizeFirstLetter(targetState)}Target`;
    }

    /**
     * Converts a BazelTarget into a display item for the tree.
     */
    private getTargetTreeItem(element: BazelTarget): vscode.TreeItem {
        const isExpanded = this.getExpandedState(element.id);
        const collapsibleState = isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;

        const treeItem = new vscode.TreeItem(element.label, collapsibleState);
        const targetState = this.bazelTargetStateManager.getTargetState(element);

        treeItem.contextValue = this.formatTargetContextValue(element, targetState);

        treeItem.label = element.label;
        treeItem.tooltip = `${element.action} ${element.buildPath}`;
        const selectedTarget = this.bazelTargetManager.getSelectedTarget(element.action);
        const isSelected = selectedTarget && selectedTarget.id === element.id;
        if (isSelected) {
            treeItem.label = `● ${treeItem.label}`;
            treeItem.tooltip = `● ${treeItem.tooltip}`;
        }
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

    private getUserCustomCategoryTreeItem(category: UserCustomCategory): vscode.TreeItem {
        const isExpanded = this.getExpandedState(category.id);
        const collapsibleState = isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
        const item = new vscode.TreeItem(category.title, collapsibleState);
        item.contextValue = 'customCategory';
        if (category.icon !== undefined && category.icon.length > 0) {
            item.iconPath = new vscode.ThemeIcon(category.icon);
        }
        return item;
    }

    private getUserCustomButtonTreeItem(button: UserCustomButton): vscode.TreeItem {
        const item = new vscode.TreeItem(button.title, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'customButton';
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
        } else if (element instanceof BazelTargetMultiPropertyItem) {
            return Promise.resolve(this.getPropertyChildTreeItem(element));
        } else if (element instanceof UserCustomCategory) {
            return Promise.resolve(this.getUserCustomCategoryTreeItem(element));
        } else if (element instanceof UserCustomButton) {
            return Promise.resolve(this.getUserCustomButtonTreeItem(element));
        } else {
            throw Error(`No such type of tree element allowed: ${element}`);
        }

    }

    // Store the expanded/collapsed state in workspaceState
    private setExpandedState(itemId: string, isExpanded: boolean) {
        this.expandedStateCache[itemId] = isExpanded;
        this.debouncedSaveExpandedState();
    }

    // Get the expanded/collapsed state for a given item
    private getExpandedState(itemId: string): boolean {
        return this.expandedStateCache[itemId] ?? false;  // Default to false if not in cache
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