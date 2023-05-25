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
import { History } from './history';

vscode.commands.registerCommand('bluebazel.editSinglePropTreeItem', (node: SinglePropTreeItem) => {
    node.runEdit();
});

export class SinglePropTreeItem extends vscode.TreeItem {
    private m_edit: () => void;
    private m_originalLabel: string;
    private m_value: string;
    private m_history: History;

    constructor(label: string,
        private readonly workspaceKey: string,
        private workspaceState: Storage,
        private onUpdate: () => void,
        contextValuePrefix?: string,
        onAddOptions?: (key: string) => Promise<string[]>,
        onEdit?: (itemOld: string, itemNew: string) => void) {
        super(label);
        this.m_originalLabel = label;
        this.m_history = new History(workspaceState, `${this.workspaceKey}History`, 10);
        contextValuePrefix = contextValuePrefix || '';
        this.contextValue = `${contextValuePrefix}SinglePropTreeItem`;
        this.m_value = workspaceState.get<string>(this.workspaceKey) || '';

        this.label = `${this.m_originalLabel} ${this.m_value}`;
        const getAddOptions = onAddOptions || ((key: string) => {
            return new Promise<string[]>((resolve, reject) => {
                resolve(this.m_history.getHistory());
            });
        });

        this.m_edit = () => {
            getAddOptions(this.workspaceKey)
                .then(data => {
                    quickPick(data, (data: string) => {
                        this.edit(data);
                        if (onEdit) {
                            onEdit(this.m_value, data);
                        }
                    });
                }).catch(err => vscode.window.showErrorMessage(err));
        };


    }

    public runEdit() {
        this.m_edit();
    }

    private updateModel() {
        this.workspaceState.update(this.workspaceKey, this.getValue());
    }

    public edit(newValue: string) {
        this.m_value = newValue;
        this.label = `${this.m_originalLabel} ${this.m_value}`;
        this.m_history.add(newValue);
        this.updateModel();
        this.onUpdate();
    }

    public getValue(): string {
        return this.m_value;
    }
}