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

export class SinglePropTreeItem extends vscode.TreeItem {
    private editFunc: () => void;
    private originalLabel: string;
    private value: string;
    private history: BazelTargetPropertyHistory;

    constructor(context: vscode.ExtensionContext,
        label: string,
        private model: Model,
        private onUpdate: () => void,
        contextValuePrefix?: string,
        onAddOptions?: (key: string) => Promise<string[]>,
        onEdit?: (itemOld: string, itemNew: string) => void) {
        super(label);
        this.originalLabel = label;
        this.history = new BazelTargetPropertyHistory(context, model.name, 10);
        contextValuePrefix = contextValuePrefix || '';
        this.contextValue = `${contextValuePrefix}SinglePropTreeItem`;
        this.value = model.get<string>() || '';

        this.label = `${this.originalLabel} ${this.value}`;
        const getAddOptions = onAddOptions || ((key: string) => {
            return new Promise<string[]>((resolve, reject) => {
                resolve(this.history.getHistory());
            });
        });

        this.editFunc = () => {
            getAddOptions(model.name)
                .then(data => {
                    showQuickPick(data, (data: string) => {
                        this.edit(data);
                        if (onEdit) {
                            onEdit(this.value, data);
                        }
                    });
                }).catch(err => vscode.window.showErrorMessage(err));
        };


    }

    public runEdit() {
        this.editFunc();
    }

    public runCopy() {
        vscode.env.clipboard.writeText(this.value);
    }

    private updateModel() {
        this.model.update(this.getValue());
    }

    public edit(newValue: string) {
        this.value = newValue;
        this.label = `${this.originalLabel} ${this.value}`;
        this.history.add(newValue);
        this.updateModel();
        this.onUpdate();
    }

    public getValue(): string {
        return this.value;
    }
}