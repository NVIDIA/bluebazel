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
import { quickPick } from './quickPicker';
import {History} from './history';

vscode.commands.registerCommand('bluebazel.addToMultiPropTreeItem', (node: MultiPropTreeItem) => {
    node.runAdd(node);
});
vscode.commands.registerCommand('bluebazel.editMultiPropTreeItem', (node: MultiPropTreeItemChild) => {
    node.getParent().runEdit(node);
});

vscode.commands.registerCommand('bluebazel.removeMultiPropTreeItem', (node: MultiPropTreeItemChild) => {
    node.getParent().runRemove(node);
});

vscode.commands.registerCommand('bluebazel.copyMultiPropTreeItem', (node: MultiPropTreeItemChild) => {
    node.getParent().runCopy(node);
});


class MultiPropTreeItemChild extends vscode.TreeItem {
    private m_parent: MultiPropTreeItem;
    constructor(label: string,
        contextValue: string,
        parent: MultiPropTreeItem
    ) {
        super(label);
        this.contextValue = `${contextValue}Child`;
        this.m_parent = parent;
    }

    public getParent(): MultiPropTreeItem {
        return this.m_parent;
    }
}

export class MultiPropTreeItem extends vscode.TreeItem {
    private m_children: MultiPropTreeItemChild[];
    private m_add: (node: vscode.TreeItem) => void;
    private m_edit: (node: MultiPropTreeItemChild) => void;
    private m_remove: (node: MultiPropTreeItemChild) => void;
    private m_history: History;

    constructor(label: string,
        private readonly workspaceKey: string,
        private workspaceState: Storage,
        private onUpdate: () => void,
        onAddOptions?: (key: string) => Promise<string[]>,
        onAdd?: (item: string) => void,
        onEdit?: (itemOld: string, itemNew: string) => void,
        onRemove?: (item: string) => void,
        collapsibleState?: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
        this.m_history = new History(workspaceState, `${this.workspaceKey}History`, 10);

        this.contextValue = 'MultiPropTreeItem';

        this.m_children = this.childrenFromStringArray(this.workspaceState.get<string[]>(this.workspaceKey) || []);
        if (this.m_children.length > 0) {
            this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        }
        const getAddOptions = onAddOptions || ((key: string) => {
            return new Promise<string[]>((resolve, reject) => {
                resolve(this.m_history.getHistory());
            });
        });

        this.m_add = (node: vscode.TreeItem) => {
            getAddOptions(this.workspaceKey)
                .then(data => {
                    quickPick(data, (data: string) => {
                        this.add(data);
                        if (onAdd) {
                            onAdd(data);
                        }
                    });
                }).catch(err => vscode.window.showErrorMessage(err));
        };

        this.m_edit = (node: MultiPropTreeItemChild) => {
            // Edit this in the list
            vscode.window.showInputBox({
                value: node.label
            }).then(data => {
                if (data !== undefined) {
                    if (data.replace(/\s/g, '') === '') {
                        this.remove(node);
                    } else {
                        this.edit(node, data);
                    }
                    if (onEdit) {
                        onEdit(node.label || '', data);
                    }
                }
            });
        };

        this.m_remove = (node: MultiPropTreeItemChild) => {
            this.remove(node);
            if (onRemove) {
                onRemove(node.label || '');
            }
        };
    }

    public runAdd(node: vscode.TreeItem) {
        this.m_add(node);
    }

    public runEdit(node: MultiPropTreeItemChild) {
        this.m_edit(node);
    }

    public runRemove(node: MultiPropTreeItemChild) {
        this.m_remove(node);
    }

    public runCopy(node: MultiPropTreeItemChild) {
        vscode.env.clipboard.writeText(node.label || '');
    }


    private updateModel() {
        const childSet = Array.from(new Set<string>(this.getChildrenAsStringArray()));
        this.workspaceState.update(this.workspaceKey, childSet);
    }

    public add(label: string) {
        const item = new MultiPropTreeItemChild(label, this.contextValue || '', this);
        this.m_children.push(item);
        this.m_history.add(label);
        this.updateModel();
        this.onUpdate();
    }

    public edit(child: vscode.TreeItem, newLabel: string) {
        child.label = newLabel;
        this.updateModel();
        this.onUpdate();
    }

    public remove(child: MultiPropTreeItemChild) {
        const tmp = new Set<MultiPropTreeItemChild>(this.m_children);
        tmp.delete(child);
        this.m_children = Array.from(tmp);
        this.updateModel();
        this.onUpdate();
    }

    private childrenFromStringArray(childLabels: string[]): MultiPropTreeItemChild[] {
        const result: MultiPropTreeItemChild[] = [];
        for (const label of childLabels) {
            if (label) {
                result.push(new MultiPropTreeItemChild(label,
                    this.contextValue || '', this));
            }
        }
        return result;
    }

    private getChildrenAsStringArray(): string[] {
        const result: string[] = [];
        for (const child of this.m_children) {
            if (child.label) {
                result.push(child.label);
            }
        }
        return result;
    }

    public getChildren(): vscode.TreeItem[] {
        return this.m_children;
    }
}