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

import { showQuickPick } from './quick-pick';
import { BazelTargetPropertyHistory } from '../models/bazel-target-property-history';
import { Model } from '../models/model';
import * as vscode from 'vscode';

export class MultiPropTreeItemChild extends vscode.TreeItem {
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
    private children: MultiPropTreeItemChild[];
    private addFunc: (node: vscode.TreeItem) => void;
    private editFunc: (node: MultiPropTreeItemChild) => void;
    private removeFunc: (node: MultiPropTreeItemChild) => void;
    private history: BazelTargetPropertyHistory;

    constructor(context: vscode.ExtensionContext,
        label: string,
        public readonly model: Model,
        private onUpdate: () => void,
        onAddOptions?: (key: string) => Promise<string[]>,
        onAdd?: (item: string) => void,
        onEdit?: (itemOld: string, itemNew: string) => void,
        onRemove?: (item: string) => void,
        collapsibleState?: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
        this.history = new BazelTargetPropertyHistory(context, model.name, 10);

        this.contextValue = 'MultiPropTreeItem';

        this.children = this.childrenFromStringArray(this.model.get<string[]>() || []);
        if (this.children.length > 0) {
            this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        }
        const getAddOptions = onAddOptions || ((key: string) => {
            return new Promise<string[]>((resolve, reject) => {
                resolve(this.history.getHistory());
            });
        });

        this.addFunc = (node: vscode.TreeItem) => {
            getAddOptions(model.name)
                .then(data => {
                    showQuickPick(data, (data: string) => {
                        this.add(data);
                        if (onAdd) {
                            onAdd(data);
                        }
                    });
                }).catch(err => vscode.window.showErrorMessage(err));
        };

        this.editFunc = (node: MultiPropTreeItemChild) => {
            // Edit this in the list
            vscode.window.showInputBox({
                value: node.label?.toString() || ''
            }).then(data => {
                if (data !== undefined) {
                    if (data.replace(/\s/g, '') === '') {
                        this.remove(node);
                    } else {
                        this.edit(node, data);
                    }
                    if (onEdit) {
                        onEdit(node.label?.toString() || '', data);
                    }
                }
            });
        };

        this.removeFunc = (node: MultiPropTreeItemChild) => {
            this.remove(node);
            if (onRemove) {
                onRemove(node.label?.toString() || '');
            }
        };
    }

    public runAdd(node: vscode.TreeItem) {
        this.addFunc(node);
    }

    public runEdit(node: MultiPropTreeItemChild) {
        this.editFunc(node);
    }

    public runRemove(node: MultiPropTreeItemChild) {
        this.removeFunc(node);
    }

    public runCopy(node: MultiPropTreeItemChild) {
        vscode.env.clipboard.writeText(node.label?.toString() || '');
    }


    private updateModel() {
        const childSet = Array.from(new Set<string>(this.getChildrenAsStringArray()));
        this.model.update(childSet);
    }

    public add(label: string) {
        const item = new MultiPropTreeItemChild(label, this.contextValue || '', this);
        this.children.push(item);
        this.history.add(label);
        this.updateModel();
        this.onUpdate();
    }

    public edit(child: vscode.TreeItem, newLabel: string) {
        child.label = newLabel;
        this.updateModel();
        this.onUpdate();
    }

    public remove(child: MultiPropTreeItemChild) {
        const tmp = new Set<MultiPropTreeItemChild>(this.children);
        tmp.delete(child);
        this.children = Array.from(tmp);
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
        for (const child of this.children) {
            if (child.label) {
                result.push(child.label?.toString());
            }
        }
        return result;
    }

    public getChildren(): vscode.TreeItem[] {
        return this.children;
    }
}